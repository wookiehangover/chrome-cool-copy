import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/auth-layout.tsx", [
    route("all", "routes/all.tsx"),
  ]),
  route("share/:shareId", "routes/share.$shareId.tsx"),
  route("media/:id", "routes/media.$id.tsx"),
  route("api/share", "routes/api/share.tsx"),
  route("api/media/list", "routes/api/media.list.tsx"),
  route("api/media/upload", "routes/api/media.upload.tsx"),
  route("api/media/:id", "routes/api/media.$id.tsx"),
  route("*", "routes/$.tsx"),
  index("routes/index.tsx"),
] satisfies RouteConfig;
