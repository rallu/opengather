import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PostLabels } from "./post-labels.tsx";

const agentMarkup = renderToStaticMarkup(<PostLabels isAgent />);
assert.match(agentMarkup, />Agent</);

const emptyMarkup = renderToStaticMarkup(<PostLabels />);
assert.equal(emptyMarkup, "");

console.log("post-labels render validation passed");
