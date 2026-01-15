
export async function loader() {
  // redirect to sambreed.dev
  return new Response("Redirecting to sambreed.dev", {
    status: 302,
    headers: {
      Location: "https://sambreed.dev",
    },
  });
}