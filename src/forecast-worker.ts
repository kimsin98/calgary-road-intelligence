import { forecast } from "./forecast.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: forecast(data.events, data.locations, data.config),
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
