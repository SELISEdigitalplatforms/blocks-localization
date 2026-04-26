import { createBrowserRouter } from "react-router-dom";
import { getAppRouteTree } from "./routes";

export const appRouter = createBrowserRouter(getAppRouteTree());
