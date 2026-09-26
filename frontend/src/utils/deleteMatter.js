import { supabase } from "../lib/supabaseClient";

export async function deleteMatterAndRelatedData(matterId) {
  if (!matterId) {
    throw new Error("A matter ID is required.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your session could not be verified.");
  }

  // Calendar events use ON DELETE SET NULL, so remove matter-linked
  // calendar rows explicitly before deleting the matter itself.
  const { error: calendarError } = await supabase
    .from("calendar_events")
    .delete()
    .eq("matter_id", matterId);

  if (calendarError) {
    throw calendarError;
  }

  // Evidence, matter_actions, matter_issue_tags, matter_reminders, and
  // timeline_events are configured with ON DELETE CASCADE in Supabase.
  const { data: deletedMatter, error: matterError } = await supabase
    .from("matters")
    .delete()
    .eq("id", matterId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (matterError) {
    throw matterError;
  }

  if (!deletedMatter) {
    throw new Error("Verdict could not delete this matter.");
  }

  return deletedMatter;
}
