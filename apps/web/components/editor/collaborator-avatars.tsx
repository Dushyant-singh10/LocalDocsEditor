import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AwareUser {
  clientId: number;
  name?: string;
  color?: string;
}

export function CollaboratorAvatars({ users }: { users: AwareUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {users.slice(0, 6).map((user) => (
        <Tooltip key={user.clientId}>
          <TooltipTrigger asChild>
            <Avatar className="size-7 border-2 border-background">
              <AvatarFallback
                style={{ backgroundColor: user.color ?? "#94a3b8" }}
                className="text-[10px] text-white font-medium"
              >
                {(user.name ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{user.name ?? "Anonymous"}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
