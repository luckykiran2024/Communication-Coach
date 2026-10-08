const os = require("node:os");
const path = require("node:path");
os.userInfo = () => ({
  username: process.env.USERNAME ?? "codex",
  uid: -1,
  gid: -1,
  shell: null,
  homedir: process.env.USERPROFILE ?? process.cwd(),
});
const shim = path.resolve(__dirname, "node-os-compat.cjs");
if (!process.env.NODE_OPTIONS?.includes(shim)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --require=${shim}`.trim();
