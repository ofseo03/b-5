import { useEffect, useState } from "react";

export type Route =
  | { name: "discover" }
  | { name: "chats" }
  | { name: "room"; id: string }
  | { name: "persona" };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "chats") return { name: "chats" };
  if (parts[0] === "room" && parts[1]) return { name: "room", id: parts[1] };
  if (parts[0] === "persona") return { name: "persona" };
  return { name: "discover" };
}

export function go(route: Route): void {
  location.hash = route.name === "room" ? `#/room/${route.id}` : `#/${route.name}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
