import { useEffect, useState } from "react";
import { CommandBar } from "../layout/CommandBar";
import { LauncherRail } from "../layout/LauncherRail";
import { SystemNav } from "../layout/SystemNav";
import { ChatArea } from "../layout/ChatArea";
import { IntelPanel } from "../layout/IntelPanel";
import { FriendsScreen } from "../modules/FriendsScreen";
import { RadioScreen } from "../modules/RadioScreen";
import { GameHostingScreen } from "../modules/GameHostingScreen";
import { DevPortalScreen } from "../modules/DevPortalScreen";
import { ToolboxScreen } from "../modules/ToolboxScreen";
import { SettingsModal } from "../modals/SettingsModal";
import { SearchModal } from "../modals/SearchModal";
import { UserProfilePopover } from "../modals/UserProfilePopover";
import { Toasts } from "../common/Toasts";
import { ScreenShareHost } from "../chat/ScreenShareHost";
import { useStore } from "../../store/store";
import "./MainScreen.css";

interface PopoverState {
  userId: string;
  anchor: { x: number; y: number };
}

export function MainScreen() {
  const { currentUserId, activeModule } = useStore();
  const [intelVisible, setIntelVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openProfileAt = (userId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 304);
    const y = Math.min(rect.top, window.innerHeight - 320);
    setPopover({ userId, anchor: { x: Math.max(80, x), y: Math.max(60, y) } });
  };

  const openIntelProfile = (userId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ userId, anchor: { x: rect.left - 292, y: rect.top } });
  };

  const openOwnProfile = (userId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      userId,
      anchor: { x: rect.right + 8, y: Math.max(60, rect.top - 200) },
    });
  };

  const isChat =
    activeModule === "chat" || activeModule === "personal";
  const isPersonal = activeModule === "personal";
  const shellClass = [
    "shell",
    isChat && intelVisible && !isPersonal ? "shell--intel" : "",
    isChat && (!intelVisible || isPersonal) ? "shell--chat" : "",
    !isChat ? "shell--module" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <CommandBar onOpenCommand={() => setSearchOpen(true)} />
      <ScreenShareHost />

      <LauncherRail
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={(e) => openOwnProfile(currentUserId, e)}
      />

      {isChat ? (
        <>
          <SystemNav
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenProfile={(e) => openOwnProfile(currentUserId, e)}
          />
          <ChatArea
            intelVisible={intelVisible && !isPersonal}
            onToggleIntel={() => setIntelVisible((v) => !v)}
            onOpenSearch={() => setSearchOpen(true)}
          />
          {intelVisible && !isPersonal ? (
            <IntelPanel onSelectMember={openIntelProfile} />
          ) : null}
        </>
      ) : (
        <div className="shell__module">
          {activeModule === "friends" ? (
            <FriendsScreen onSelectMember={openProfileAt} />
          ) : null}
          {activeModule === "radio" ? <RadioScreen /> : null}
          {activeModule === "games" ? <GameHostingScreen /> : null}
          {activeModule === "devportal" ? <DevPortalScreen /> : null}
          {activeModule === "toolbox" ? <ToolboxScreen /> : null}
        </div>
      )}

      {settingsOpen ? (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      ) : null}
      {searchOpen ? (
        <SearchModal onClose={() => setSearchOpen(false)} />
      ) : null}
      {popover ? (
        <UserProfilePopover
          userId={popover.userId}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      ) : null}
      <Toasts />
    </div>
  );
}
