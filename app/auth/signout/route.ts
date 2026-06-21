import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClientForRouteHandler } from "@/lib/supabase/route";

async function signOutAndRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });

  try {
    const supabase = createClientForRouteHandler(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.auth.signOut();
    }
  } catch {
    // Missing env or sign-out error — still redirect to login.
  }

  revalidatePath("/", "layout");
  return response;
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}
