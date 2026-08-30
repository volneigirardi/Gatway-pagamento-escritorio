import { describe, expect, it } from "vitest";
import { QaStateMachine, qaEventSchema } from "./state-machine.js";

describe("QaStateMachine", () => {
  it("starts in NAO_INICIADA", () => {
    const machine = new QaStateMachine();
    expect(machine.current).toBe("NAO_INICIADA");
    expect(machine.isTerminal).toBe(false);
  });

  it("transitions NAO_INICIADA -> EM_EXECUCAO on START", () => {
    const machine = new QaStateMachine();
    const transition = machine.transition("START");
    expect(transition.from).toBe("NAO_INICIADA");
    expect(transition.to).toBe("EM_EXECUCAO");
    expect(transition.event).toBe("START");
    expect(machine.current).toBe("EM_EXECUCAO");
  });

  it("transitions EM_EXECUCAO -> APROVADA on PASS", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("PASS");
    expect(machine.current).toBe("APROVADA");
    expect(machine.isTerminal).toBe(true);
  });

  it("transitions EM_EXECUCAO -> BLOQUEADA on FAIL", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("FAIL");
    expect(machine.current).toBe("BLOQUEADA");
    expect(machine.isTerminal).toBe(true);
  });

  it("transitions EM_EXECUCAO -> BLOQUEADA on BLOCK", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("BLOCK");
    expect(machine.current).toBe("BLOQUEADA");
  });

  it("transitions EM_EXECUCAO -> INCONCLUSIVA on INCONCLUSIVE", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("INCONCLUSIVE");
    expect(machine.current).toBe("INCONCLUSIVA");
  });

  it("transitions BLOQUEADA -> EM_EXECUCAO on RETEST", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("FAIL");
    machine.transition("RETEST");
    expect(machine.current).toBe("EM_EXECUCAO");
  });

  it("transitions INCONCLUSIVA -> EM_EXECUCAO on RETEST", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("INCONCLUSIVE");
    machine.transition("RETEST");
    expect(machine.current).toBe("EM_EXECUCAO");
  });

  it("rejects invalid transition from NAO_INICIADA with PASS", () => {
    const machine = new QaStateMachine();
    expect(() => machine.transition("PASS")).toThrow(
      /Invalid transition: cannot apply "PASS" to state "NAO_INICIADA"/u,
    );
  });

  it("rejects invalid transition from APROVADA with START", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("PASS");
    expect(() => machine.transition("START")).toThrow(
      /Invalid transition: cannot apply "START" to state "APROVADA"/u,
    );
  });

  it("reports canTransition correctly", () => {
    const machine = new QaStateMachine();
    expect(machine.canTransition("START")).toBe(true);
    expect(machine.canTransition("PASS")).toBe(false);
    machine.transition("START");
    expect(machine.canTransition("PASS")).toBe(true);
    expect(machine.canTransition("START")).toBe(false);
  });

  it("records history in append-only order", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("FAIL");
    machine.transition("RETEST");
    machine.transition("PASS");
    expect(machine.history).toHaveLength(4);
    expect(machine.history[0]?.to).toBe("EM_EXECUCAO");
    expect(machine.history[1]?.to).toBe("BLOQUEADA");
    expect(machine.history[2]?.to).toBe("EM_EXECUCAO");
    expect(machine.history[3]?.to).toBe("APROVADA");
  });

  it("resets to initial state and clears history", () => {
    const machine = new QaStateMachine();
    machine.transition("START");
    machine.transition("PASS");
    machine.reset();
    expect(machine.current).toBe("NAO_INICIADA");
    expect(machine.history).toHaveLength(0);
  });
});

describe("qaEventSchema", () => {
  it("accepts known events", () => {
    for (const event of [
      "START",
      "PASS",
      "FAIL",
      "BLOCK",
      "INCONCLUSIVE",
      "RETEST",
    ]) {
      expect(qaEventSchema.parse(event)).toBe(event);
    }
  });

  it("rejects unknown events", () => {
    expect(() => qaEventSchema.parse("APPROVE")).toThrow();
  });
});
