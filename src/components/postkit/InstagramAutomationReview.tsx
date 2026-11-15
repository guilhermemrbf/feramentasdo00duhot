export function InstagramAutomationReview({
  username,
  confirmed,
  onConfirm,
  disabled,
}: {
  username: string;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="mt-5 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4"
    >
      <legend className="px-2 font-semibold">Revisar Reels · @{username}</legend>
      <p className="text-sm text-muted-foreground">
        Stories têm biblioteca e agenda próprias. Esta ativação agenda somente os Reels abaixo.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        Conferi a conta, os vídeos, legenda, hashtags, capa e horários. Autorizo esta programação de
        Reels.
      </label>
    </fieldset>
  );
}
