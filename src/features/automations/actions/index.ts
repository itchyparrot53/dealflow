// Registers every action handler. The runner imports this module for its side effects, so a new
// action file is one import away from being live.
import "./addNote";
import "./aiActions";
import "./createActivity";
import "./notifyUser";
import "./sendEmail";
import "./updateDeal";

export { getActionHandler, registerActionHandler, registeredActionTypes } from "./registry";
