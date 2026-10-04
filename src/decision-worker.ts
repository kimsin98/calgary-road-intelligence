import { optimize } from "./decision.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: optimize(data.events, data.locations, data.config),
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
