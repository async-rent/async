import { Avatar, AvatarFallback, AvatarImage } from "@async-rent/ui/components/avatar";
import { Button } from "@async-rent/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@async-rent/ui/components/dropdown-menu";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { RiFileList3Line, RiLogoutBoxRLine, RiSettings3Line, RiUser3Line } from "@remixicon/react";
import { Link } from "@tanstack/react-router";

/**
 * The signed-in visitor's account menu, in place of Clerk's stock UserButton.
 * Profile settings and sign-out still go through Clerk; Async's own entries
 * (My rentals, then Operations) sit in the account group.
 */
export function ProfileMenu() {
  const clerk = useClerk();
  const { user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName ?? user?.username ?? email;
  const initials = initialsOf(name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Profile menu"
        render={<Button variant="ghost" size="icon-lg" className="rounded-full p-0" />}
      >
        <Avatar size="lg">
          {/* Clerk always returns an imageUrl; it is a generated stand-in unless hasImage. */}
          {user?.hasImage && <AvatarImage src={user.imageUrl} alt="" />}
          <AvatarFallback>{initials ?? <RiUser3Line />}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          {name && (
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              {email && email !== name && <span className="truncate">{email}</span>}
            </DropdownMenuLabel>
          )}
          <DropdownMenuLinkItem render={<Link to="/rentals" />}>
            <RiFileList3Line />
            My rentals
          </DropdownMenuLinkItem>
          <DropdownMenuItem onClick={() => clerk.openUserProfile()}>
            <RiSettings3Line />
            Profile settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void clerk.signOut()}>
            <RiLogoutBoxRLine />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Up to two initials from a display name, or the first letter of an email. */
function initialsOf(name: string | undefined) {
  if (!name) return undefined;
  const words = name.includes("@") ? [name] : name.trim().split(/\s+/);
  const letters = words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
  return letters ? letters.toUpperCase() : undefined;
}
