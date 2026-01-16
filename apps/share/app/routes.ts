import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("*", "routes/$.tsx"),
  route("all", "routes/all.tsx"),
  route("share/:shareId", "routes/share.$shareId.tsx"),
  route("api/share", "routes/api/share.tsx"),
  index('routes/index.tsx')
] satisfies RouteConfig;
