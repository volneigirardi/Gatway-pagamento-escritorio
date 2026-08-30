import { z } from "zod";

export const qaStateSchema = z.enum([
  "NAO_INICIADA",
  "EM_EXECUCAO",
  "APROVADA",
  "BLOQUEADA",
  "INCONCLUSIVA",
]);

export type QaState = z.infer<typeof qaStateSchema>;

export const terminalStates: readonly QaState[] = [
  "APROVADA",
  "BLOQUEADA",
  "INCONCLUSIVA",
] as const;

export const qaEventSchema = z.enum([
  "START",
  "PASS",
  "FAIL",
  "BLOCK",
  "INCONCLUSIVE",
  "RETEST",
]);

export type QaEvent = z.infer<typeof qaEventSchema>;

type TransitionMap = Record<QaState, Partial<Record<QaEvent, QaState>>>;

const transitions: TransitionMap = {
  NAO_INICIADA: {
    START: "EM_EXECUCAO",
  },
  EM_EXECUCAO: {
    PASS: "APROVADA",
    FAIL: "BLOQUEADA",
    BLOCK: "BLOQUEADA",
    INCONCLUSIVE: "INCONCLUSIVA",
  },
  APROVADA: {},
  BLOQUEADA: {
    RETEST: "EM_EXECUCAO",
  },
  INCONCLUSIVA: {
    RETEST: "EM_EXECUCAO",
  },
};

export interface StateTransition {
  readonly from: QaState;
  readonly event: QaEvent;
  readonly to: QaState;
  readonly timestamp: string;
}

export class QaStateMachine {
  private _current: QaState = "NAO_INICIADA";
  private readonly _history: StateTransition[] = [];

  get current(): QaState {
    return this._current;
  }

  get history(): readonly StateTransition[] {
    return this._history;
  }

  get isTerminal(): boolean {
    return (terminalStates as readonly string[]).includes(this._current);
  }

  transition(event: QaEvent): StateTransition {
    const allowed = transitions[this._current];
    const next = allowed[event];
    if (!next) {
      throw new Error(
        `Invalid transition: cannot apply "${event}" to state "${this._current}"`,
      );
    }
    const record: StateTransition = {
      from: this._current,
      event,
      to: next,
      timestamp: new Date().toISOString(),
    };
    this._history.push(record);
    this._current = next;
    return record;
  }

  canTransition(event: QaEvent): boolean {
    const allowed = transitions[this._current];
    return allowed[event] !== undefined;
  }

  reset(): void {
    this._current = "NAO_INICIADA";
    this._history.length = 0;
  }
}
