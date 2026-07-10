import type { CandidateAttempt, HardValidCandidate } from "@lego-studio/generation";

import type { CandidateLabState } from "../generation/candidate-lab-controller";

interface AssistantPanelProps {
  readonly prompt: string;
  readonly lab: CandidateLabState;
  readonly onPromptChange: (prompt: string) => void;
  readonly onGenerate: () => void;
  readonly onSelectCandidate: (candidateId: string) => void;
  readonly onClear: () => void;
}

function score(value: number): string {
  return `${Math.round(value / 100)}%`;
}

function lineage(attempt: CandidateAttempt): string {
  return `${attempt.lineage.parentCandidateId ?? "root"} -> ${attempt.strategyId}`;
}

function CandidateMetrics({ candidate }: { readonly candidate: HardValidCandidate }) {
  return (
    <span className="candidate-metrics">
      <span>
        <span className="candidate-metric-label">Parts</span>
        <span className="candidate-metric-value">{candidate.metrics.partCount}</span>
      </span>
      <span>
        <span className="candidate-metric-label">Connections</span>
        <span className="candidate-metric-value">{candidate.metrics.connectionCount}</span>
      </span>
      <span>
        <span className="candidate-metric-label">Intent</span>
        <span className="candidate-metric-value">
          {score(candidate.metrics.weightedScorePermyriad)}
        </span>
      </span>
      <span>
        <span className="candidate-metric-label">Diversity</span>
        <span className="candidate-metric-value">
          {score(candidate.metrics.diversityPermyriad)}
        </span>
      </span>
    </span>
  );
}

function AttemptCard({
  attempt,
  selected,
  onSelect,
}: {
  readonly attempt: CandidateAttempt;
  readonly selected: boolean;
  readonly onSelect: (candidateId: string) => void;
}) {
  if (attempt.status === "hard-valid") {
    return (
      <li>
        <button
          type="button"
          className={`candidate-attempt is-valid${selected ? " is-selected" : ""}`}
          aria-pressed={selected}
          aria-label={`Preview rank ${attempt.rank} candidate, ${attempt.metrics.partCount} parts`}
          onClick={() => onSelect(attempt.candidateId)}
        >
          <span className="candidate-attempt__heading">
            <strong>Rank {attempt.rank}</strong>
            <span className="status-pill is-valid">hard-valid</span>
          </span>
          <CandidateMetrics candidate={attempt} />
          <small>Lineage: {lineage(attempt)}</small>
        </button>
      </li>
    );
  }
  return (
    <li>
      <div
        className={`candidate-attempt ${attempt.status === "duplicate" ? "is-duplicate" : "is-invalid"}`}
      >
        <span className="candidate-attempt__heading">
          <strong>{attempt.status === "duplicate" ? "Duplicate" : "Attempt failed"}</strong>
          <span className="status-pill is-invalid">{attempt.status}</span>
        </span>
        <p>
          {attempt.failure.code}: {attempt.failure.message}
        </p>
        {attempt.status === "duplicate" ? (
          <small>Duplicates: {attempt.failure.duplicateOfCandidateId}</small>
        ) : attempt.failure.stage === "compile" && attempt.failure.issues.length > 0 ? (
          <small>
            Compiler issues:{" "}
            {attempt.failure.issues
              .slice(0, 3)
              .map(({ code }) => code)
              .join(", ")}
          </small>
        ) : null}
        <small>Lineage: {lineage(attempt)}</small>
      </div>
    </li>
  );
}

export function AssistantPanel({
  prompt,
  lab,
  onPromptChange,
  onGenerate,
  onSelectCandidate,
  onClear,
}: AssistantPanelProps) {
  return (
    <section className="assistant-section" aria-labelledby="assistant-heading">
      <div className="assistant-heading">
        <div className="assistant-mark" aria-hidden="true">
          *
        </div>
        <div>
          <p className="kicker">Deterministic local lab</p>
          <h2 id="assistant-heading">Candidate population</h2>
        </div>
      </div>
      <textarea
        aria-label="Candidate lab prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={3}
        maxLength={1024}
        placeholder="Build an 18-piece red and yellow tower"
      />
      <div className="button-row">
        <button
          type="button"
          className="assistant-action"
          disabled={lab.status === "running"}
          onClick={onGenerate}
        >
          <span aria-hidden="true">*</span>{" "}
          {lab.status === "running" ? "Generating..." : "Generate 4 candidates"}
        </button>
        {lab.status !== "idle" ? (
          <button type="button" className="quiet-action" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {lab.status === "idle" ? (
        <p className="assistant-note">
          Runs deterministic templates in an isolated browser worker. No provider or network call is
          made, and candidate acceptance remains disabled.
        </p>
      ) : null}
      {lab.status === "running" ? (
        <div className="candidate-card" role="status" aria-live="polite">
          <strong>Compiling a bounded four-attempt population...</strong>
          <span>Manual editing remains available; any edit cancels this captured base.</span>
        </div>
      ) : null}
      {lab.status === "failed" ? (
        <div className="candidate-card is-invalid" role="alert">
          <strong>{lab.failure.detailCode ?? lab.failure.code}</strong>
          <span>{lab.failure.message}</span>
        </div>
      ) : null}
      {lab.status === "ready" ? (
        <>
          <div className="candidate-run-summary">
            <span>{lab.population.attempts.length} attempts</span>
            <span>{lab.population.rankedCandidates.length} hard-valid</span>
            <span>{Math.round(lab.verificationDurationMs)} ms trusted replay</span>
          </div>
          <ol className="candidate-population" aria-label="Candidate attempts">
            {[
              ...lab.population.rankedCandidates,
              ...lab.population.attempts.filter(({ status }) => status !== "hard-valid"),
            ].map((attempt) => (
              <AttemptCard
                key={attempt.candidateId}
                attempt={attempt}
                selected={lab.selectedCandidateId === attempt.candidateId}
                onSelect={onSelectCandidate}
              />
            ))}
          </ol>
          <button type="button" className="secondary-action candidate-accept" disabled>
            Accept candidate - companion broker required
          </button>
          <p className="assistant-note">
            Preview selection changes only the derived viewport. It never mutates the saved
            BrickDocument.
          </p>
        </>
      ) : null}
    </section>
  );
}
