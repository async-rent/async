import { Tabs, TabsList, TabsTrigger } from "@async-rent/ui/components/tabs";
import { RiRobot2Line, RiUserLine } from "@remixicon/react";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";

const audiences = [
  { value: "human", label: "Human", icon: RiUserLine, to: "/" },
  { value: "agent", label: "Agent", icon: RiRobot2Line, to: "/agents" },
] as const;

/**
 * "I'm a Human | Agent": switches the page between the shop and the agent
 * setup guide. The route is the state, so either side can be linked to.
 */
export function AudienceSwitch() {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const current = matchRoute({ to: "/agents" }) ? "agent" : "human";

  return (
    // The label sits outside Tabs: its root stacks children in a column.
    <div className="flex shrink-0 items-center gap-2">
      <span aria-hidden="true" className="hidden text-xs whitespace-nowrap text-ink sm:inline">
        I'm a
      </span>
      <Tabs
        value={current}
        onValueChange={(value) => {
          const audience = audiences.find((item) => item.value === value);
          if (audience) void navigate({ to: audience.to });
        }}
      >
        <TabsList aria-label="I'm a" className="rounded-full group-data-horizontal/tabs:h-10">
          {audiences.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              className="rounded-full px-2.5 text-xs lg:px-3"
            >
              <Icon />
              <span className="hidden lg:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
