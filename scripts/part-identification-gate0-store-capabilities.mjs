import { failGate0 } from "./part-identification-gate0-foundation.mjs";

const capabilities = new WeakMap();
const tickets = new WeakMap();
const createObject = Object.create;
const freezeObject = Object.freeze;

function opaque() {
  return freezeObject(createObject(null));
}

export function createGate0AdmissionCapability(state) {
  const capability = opaque();
  capabilities.set(capability, state);
  return capability;
}

export function gate0AdmissionCapabilityState(capability) {
  const state = capabilities.get(capability);
  if (state === undefined) failGate0("Gate-0 admission capability is absent or foreign.");
  if (state.consumed) failGate0("Gate-0 admission capability was already consumed.");
  return state;
}

export function markGate0AdmissionCapabilityConsumed(state) {
  state.consumed = true;
}

export function createGate0LaunchTicket(state) {
  const ticket = opaque();
  tickets.set(ticket, state);
  return ticket;
}

export function gate0LaunchTicketState(ticket) {
  const state = tickets.get(ticket);
  if (state === undefined) failGate0("Gate-0 launch ticket is absent or foreign.");
  return state;
}
