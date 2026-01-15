import { Link, redirect } from "react-router";
import type { Route } from "./+types/$";

export async function loader() {
  return redirect("https://sambreed.dev");
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "404 - Page Not Found" },
    { name: "description", content: "The requested page could not be found." },
  ];
}

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Page not found
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
