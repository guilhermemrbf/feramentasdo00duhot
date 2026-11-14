import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { Button } from "../../src/components/ui/button";
import { WorkspaceSelect } from "../../src/components/ui/workspace-select";
import { WorkspaceDate } from "../../src/components/ui/workspace-date";
import { ReelCaptionFields } from "../../src/components/postkit/ReelCaptionFields";
import { ReelTimingFields } from "../../src/components/postkit/ReelTimingFields";
function Fixture() {
  const [account, setAccount] = useState("a"),
    [date, setDate] = useState("2026-11-14"),
    [caption, setCaption] = useState(""),
    [tags, setTags] = useState(""),
    [times, setTimes] = useState("09:00, 13:00");
  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 16 }}>
      <h1>Controles de teste</h1>
      <Button>Salvar</Button>
      <Button size="sm">Pequeno</Button>
      <Button size="lg">Grande</Button>
      <Button size="icon" aria-label="Ação">
        +
      </Button>
      <Button disabled>Indisponível</Button>
      <WorkspaceSelect
        label="Conta"
        value={account}
        options={[
          { value: "a", label: "Conta A" },
          { value: "b", label: "Conta B" },
        ]}
        onValueChange={setAccount}
      />
      <WorkspaceDate label="Data" value={date} onValueChange={setDate} />
      <ReelCaptionFields
        caption={caption}
        hashtags={tags}
        onCaptionChange={setCaption}
        onHashtagsChange={setTags}
      />
      <ReelTimingFields
        value={times}
        slots={times.split(",").map((s) => s.trim())}
        onChange={setTimes}
        intervalMinutes={60}
        onIntervalChange={() => {}}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
