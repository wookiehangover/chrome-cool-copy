import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("share/:shareId", "routes/share.$shareId.tsx"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
