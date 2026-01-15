import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("all", "routes/all.tsx"),
  route("share/:shareId", "routes/share.$shareId.tsx"),
  route("*", "routes/$.tsx"),
  index('routes/index.tsx')
] satisfies RouteConfig;
