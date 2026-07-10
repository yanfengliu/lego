import type { CompilationResult } from "@lego-studio/brick-kernel";

interface AssistantPanelProps {
  readonly prompt: string;
  readonly planSummary: string | null;
  readonly result: CompilationResult | null;
  readonly onPromptChange: (prompt: string) => void;
  readonly onGenerate: () => void;
  readonly onClear: () => void;
}

export function AssistantPanel({
  prompt,
  planSummary,
  result,
  onPromptChange,
  onGenerate,
  onClear,
}: AssistantPanelProps) {
  return (
    <section className="assistant-section" aria-labelledby="assistant-heading">
      <div className="assistant-heading">
        <div className="assistant-mark" aria-hidden="true">
          ✦
        </div>
        <div>
          <p className="kicker">Restricted BuildProgram</p>
          <h2 id="assistant-heading">Copilot preview</h2>
        </div>
      </div>
      <textarea
        aria-label="Copilot prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={3}
        maxLength={400}
        placeholder="Build a 4 level red and yellow tower"
      />
      <div className="button-row">
        <button type="button" className="assistant-action" onClick={onGenerate}>
          <span aria-hidden="true">✦</span> Generate preview
        </button>
        {result ? (
          <button type="button" className="quiet-action" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {result ? (
        <div className={result.ok ? "candidate-card is-valid" : "candidate-card is-invalid"}>
          <strong>{result.ok ? planSummary : "Candidate rejected"}</strong>
          {result.ok ? (
            <>
              <span>
                {result.document.parts.length} parts · {result.patch.operations.length} invertible
                operations
              </span>
              <p>
                Preview only. AI candidate acceptance remains disabled until the companion broker
                can verify scope and issue a one-use authorization.
              </p>
            </>
          ) : (
            <ul>
              {result.issues.slice(0, 3).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="assistant-note">
          This offline preview exercises the same bounded contract an AI provider must use. It does
          not call a provider or mutate your document.
        </p>
      )}
    </section>
  );
}
