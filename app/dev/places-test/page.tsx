import { notFound } from "next/navigation";

import { PlacesAutocompleteTestClient } from "./places-test-client";

export default function PlacesTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Google Places autocomplete test
        </h1>
        <p className="text-sm text-muted-foreground">
          Dev-only page for verifying{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            NEXT_PUBLIC_GOOGLE_API
          </code>{" "}
          with your HTTP referrer restrictions (localhost and production
          domain). Autocomplete runs in the browser — no public key is required
          for server routes.
        </p>
      </div>

      <PlacesAutocompleteTestClient />
    </main>
  );
}
