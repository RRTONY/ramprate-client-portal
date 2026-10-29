// Next.js ships a React build with `cache`, which shares one result per request (for example the
// signed-in profile between a layout and its page). Tests swap this module for a pass-through.
export { cache } from "react";
