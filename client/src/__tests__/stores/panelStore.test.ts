import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "../../stores/panelStore";

// Reset store before each test
beforeEach(() => {
  usePanelStore.setState({
    panels: [
      {
        id: 1,
        workspacePath: "/test/project",
        sessionKey: null,
        sessionId: null,
        title: "",
        model: null,
        thinking: "off",
        messages: [],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "",
        thinkingTokens: 0,
        streamingOutputTokens: 0,
        pinnedIndices: [],
        usage: null,
      },
    ],
    activeIndex: 0,
    nextId: 2,
  });
});

describe("panelStore", () => {
  describe("addPanel", () => {
    it("adds a new panel with next id", () => {
      const store = usePanelStore.getState();
      expect(store.panels).toHaveLength(1);

      store.addPanel();
      const next = usePanelStore.getState();
      expect(next.panels).toHaveLength(2);
      expect(next.panels[1].id).toBe(2);
    });

    it("caps at 8 panels", () => {
      const store = usePanelStore.getState();
      // Add 7 more to reach 8
      for (let i = 0; i < 7; i++) store.addPanel();
      expect(usePanelStore.getState().panels).toHaveLength(8);

      // Should not add 9th
      store.addPanel();
      expect(usePanelStore.getState().panels).toHaveLength(8);
    });

    it("sets activeIndex to new panel", () => {
      const store = usePanelStore.getState();
      store.addPanel();
      expect(usePanelStore.getState().activeIndex).toBe(1);
    });
  });

  describe("removePanel", () => {
    it("removes panel at index", () => {
      const store = usePanelStore.getState();
      store.addPanel();
      store.addPanel();
      expect(usePanelStore.getState().panels).toHaveLength(3);

      store.removePanel(1);
      expect(usePanelStore.getState().panels).toHaveLength(2);
      expect(usePanelStore.getState().panels[0].id).toBe(1);
      expect(usePanelStore.getState().panels[1].id).toBe(3);
    });

    it("prevents removing last panel", () => {
      const store = usePanelStore.getState();
      store.removePanel(0);
      expect(usePanelStore.getState().panels).toHaveLength(1);
    });

    it("adjusts activeIndex when removing active panel", () => {
      const store = usePanelStore.getState();
      store.addPanel();
      store.addPanel();
      usePanelStore.setState({ activeIndex: 1 });
      store.removePanel(1);
      expect(usePanelStore.getState().activeIndex).toBeLessThanOrEqual(1);
    });
  });

  describe("setModel", () => {
    it("updates model on panel", () => {
      usePanelStore.getState().setModel(0, "anthropic", "claude-sonnet-4-20250514");
      const panel = usePanelStore.getState().panels[0];
      expect(panel.model).toEqual({
        provider: "anthropic",
        modelId: "claude-sonnet-4-20250514",
      });
    });
  });

  describe("sendMessage flow", () => {
    it("appends user message before sending", () => {
      // Set up a mock sessionKey so sendMessage doesn't throw
      usePanelStore.setState({
        panels: [
          {
            ...usePanelStore.getState().panels[0],
            sessionKey: "test::session",
            sessionId: "session",
            workspacePath: "/test",
          },
        ],
      });

      const store = usePanelStore.getState();
      // sendMessage triggers async API call — we can't easily mock here,
      // but we verify the state mutation before API call
      store.sendMessage(0, "hello");
      // State should have user message appended
      expect(usePanelStore.getState().panels[0].messages[0]).toMatchObject({
        role: "user",
        content: "hello",
      });
      expect(usePanelStore.getState().panels[0].streaming).toBe(true);
    });
  });

  describe("branchFromMessage", () => {
    it("adds a new panel with context messages", async () => {
      usePanelStore.setState({
        panels: [
          {
            ...usePanelStore.getState().panels[0],
            sessionKey: "test::s1",
            sessionId: "s1",
            workspacePath: "/test",
            title: "Test",
            messages: [
              { role: "user", content: "Q1", timestamp: new Date().toISOString() },
              { role: "assistant", content: "A1", timestamp: new Date().toISOString() },
              { role: "user", content: "Q2", timestamp: new Date().toISOString() },
            ],
          },
        ],
      });

      // This triggers async operations — just verify panel creation
      usePanelStore.getState().branchFromMessage(0, 1);
      // Panel count should have increased
      expect(usePanelStore.getState().panels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
