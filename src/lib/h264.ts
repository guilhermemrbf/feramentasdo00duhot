/** Incremental Annex B framing. Handles split start codes, fragmented slices and
 * parameter sets; bounded so a stalled or malformed stream cannot grow forever. */
export class AnnexBFrames {
  private buffer = new Uint8Array();
  private units: Uint8Array[] = [];
  private hasSlice = false;
  private key = false;
  private unitBytes = 0;
  private sps?: Uint8Array;
  private pps?: Uint8Array;
  private output: (frame: { data: Uint8Array; key: boolean; codec: string }) => void;
  constructor(output: (frame: { data: Uint8Array; key: boolean; codec: string }) => void) {
    this.output = output;
  }
  private concat(parts: Uint8Array[]) {
    const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of parts) {
      result.set(part, at);
      at += part.length;
    }
    return result;
  }
  private emit() {
    if (this.hasSlice && this.sps && this.pps) {
      const parts = this.key
        ? [this.sps, this.pps, ...this.units.filter((n) => ![7, 8].includes(n[0] & 31))]
        : this.units;
      this.output({
        data: this.concat(parts.flatMap((n) => [new Uint8Array([0, 0, 0, 1]), n])),
        key: this.key,
        codec: `avc1.${Array.from(this.sps.slice(1, 4), (n) => n.toString(16).padStart(2, "0")).join("")}`,
      });
    }
    this.units = [];
    this.unitBytes = 0;
    this.hasSlice = false;
    this.key = false;
  }
  private nal(nal: Uint8Array) {
    if (!nal.length) return;
    const type = nal[0] & 31;
    const slice = type === 1 || type === 5;
    // ue(v) first_mb_in_slice == 0 is a leading 1 bit. Subsequent slices
    // remain in the same access unit; no B frames are requested from Android.
    if (this.hasSlice && ((slice && nal[1] & 128) || type === 9 || type === 7 || type === 8))
      this.emit();
    if (type === 7) this.sps = nal;
    if (type === 8) this.pps = nal;
    this.units.push(nal);
    this.unitBytes += nal.length;
    if (this.unitBytes > 8 * 1024 * 1024)
      throw new Error("Quadro de vídeo excedeu o limite local.");
    this.hasSlice ||= slice;
    this.key ||= type === 5;
  }
  push(bytes: Uint8Array) {
    this.buffer = this.concat([this.buffer, bytes]);
    if (this.buffer.length > 8 * 1024 * 1024)
      throw new Error("Fluxo de vídeo excedeu o limite local.");
    const starts: { at: number; size: number }[] = [];
    for (let at = 0; at + 2 < this.buffer.length; at++) {
      if (this.buffer[at] || this.buffer[at + 1]) continue;
      const size =
        this.buffer[at + 2] === 1
          ? 3
          : this.buffer[at + 2] === 0 && this.buffer[at + 3] === 1
            ? 4
            : 0;
      if (size) {
        starts.push({ at, size });
        at += size - 1;
      }
    }
    for (let n = 0; n + 1 < starts.length; n++)
      this.nal(this.buffer.slice(starts[n].at + starts[n].size, starts[n + 1].at));
    if (starts.length) this.buffer = this.buffer.slice(starts[starts.length - 1].at);
  }
  finish() {
    const size = this.buffer[2] === 1 ? 3 : 4;
    if (this.buffer.length > size) this.nal(this.buffer.slice(size));
    this.emit();
    this.buffer = new Uint8Array();
  }
}
