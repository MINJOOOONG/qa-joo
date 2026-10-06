import type { Repository } from "@/lib/db/repository";

/** Everything a service needs: the store and who is acting (for the activity log). */
export interface ServiceContext {
  repo: Repository;
  actor: string;
}
