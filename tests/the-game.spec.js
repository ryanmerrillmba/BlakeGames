const { test, expect } = require("@playwright/test");

test.describe("The Game — 3D Collision & Movement Tests", () => {
  test("loads cleanly, player faces forward, and cannot walk through walls, trees, or solid objects", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/the-game/index.html");
    await page.waitForFunction(() => window.__THE_GAME__ && window.__THE_GAME__.ready === true, {
      timeout: 45_000,
    });

    expect(errors).toEqual([]);

    // 1. Verify colliders were built for walls, trees, and solid objects
    const colliders = await page.evaluate(() => window.__THE_GAME__.getColliders());
    const walls = colliders.filter((c) => c.category === "wall");
    const trees = colliders.filter((c) => c.category === "tree");
    const objects = colliders.filter((c) => c.category === "object");

    expect(walls.length).toBeGreaterThan(5);
    expect(trees.length).toBeGreaterThan(10);
    expect(objects.length).toBeGreaterThan(5);

    // 2. Verify player faces FORWARD (not backwards) when walking toward -Z (into Lab)
    const rotForward = await page.evaluate(() => {
      window.__THE_GAME__.moveStep(0, -1, 0.05);
      return window.__THE_GAME__.getPlayerPos().rotY;
    });
    expect(Math.abs(rotForward)).toBeLessThan(0.01); // local -Z points toward -Z (rotY === 0)

    // 3. Cannot walk through solid WALLS (try walking straight into DarkRoom_Wall_Left at x = -5)
    const wallBlocked = await page.evaluate(() => {
      window.__THE_GAME__.setPlayerPos(-3.8, 0);
      for (let i = 0; i < 40; i++) window.__THE_GAME__.moveStep(-1, 0, 0.05);
      return window.__THE_GAME__.getPlayerPos().x;
    });
    expect(wallBlocked).toBeGreaterThan(-4.9);

    // 4. Cannot walk through TREES (place player next to first tree trunk and try walking through it)
    const treeBlocked = await page.evaluate(() => {
      window.__THE_GAME__.setLevel(2);
      const tree = window.__THE_GAME__.getColliders().find((c) => c.category === "tree");
      const cx = (tree.min.x + tree.max.x) / 2;
      const cz = (tree.min.z + tree.max.z) / 2;
      const startX = tree.min.x - 1.2;
      window.__THE_GAME__.setPlayerPos(startX, cz);
      for (let i = 0; i < 40; i++) window.__THE_GAME__.moveStep(1, 0, 0.05);
      const endX = window.__THE_GAME__.getPlayerPos().x;
      return { endX, centerX: cx };
    });
    expect(treeBlocked.endX).toBeLessThan(treeBlocked.centerX);

    // 5. Cannot walk through OTHER SOLID OBJECTS (Pod_Base_0 cage)
    const objectBlocked = await page.evaluate(() => {
      const pod = window.__THE_GAME__.getColliders().find((c) => c.name === "Pod_Base_0");
      const cx = (pod.min.x + pod.max.x) / 2;
      const cz = (pod.min.z + pod.max.z) / 2;
      const startZ = pod.max.z + 1.2;
      window.__THE_GAME__.setPlayerPos(cx, startZ);
      for (let i = 0; i < 40; i++) window.__THE_GAME__.moveStep(0, -1, 0.05);
      const endZ = window.__THE_GAME__.getPlayerPos().z;
      return { endZ, centerZ: cz };
    });
    expect(objectBlocked.endZ).toBeGreaterThan(objectBlocked.centerZ);
  });

  test("full 38-check physics, combat, audio, UI & performance suite passes on dev", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/the-game/index.html?test=house");
    const badge = page.locator("#autotest-results");
    await expect(badge).toBeVisible({ timeout: 60_000 });
    expect(errors).toEqual([]);
    const text = await badge.textContent();
    expect(text).toContain("ALL COLLISION TESTS PASSED");
    expect(text).toContain("House Door + Crafting Table + Portal");
    expect(text).toContain("Laser Guy");
    expect(text).toContain("Real-Time Shadows + ACES ToneMapping");
    expect(text).toContain("PMREM IBL Metallic Reflections");
    expect(text).toContain("Bloom Post-Processing + 260 Fireflies");
    expect(text).toContain("3D Hip/Shoulder Walk Pivots + Mixer");
    expect(text).toContain("Lifelike Articulated Monster Rigs (20/20)");
    expect(text).toContain("Stereo Background Music");
    expect(text).toContain("Collision, Flashlight & 20 Monster SFX");
    expect(text).toContain("Bad Guys Blocked by Solid Walls");
    expect(text).toContain("Bad Guys Blocked by Trees");
    expect(text).toContain("Monster Physics & Sliding Engine Active");
    expect(text).toContain("Dark Flashlight-Only Mode + Outside Attack");
    expect(text).toContain("One-at-a-Time Boss Progression + Bad Guys Gallery Bar");
    expect(text).toContain("Dedicated Light on Every Thing");
    expect(text).toContain("Every Single Bad Guy Faces Forward (20/20)");
    expect(text).toContain("Smooth Hero Hair + Lab Cauldrons + Compact Map");
    expect(text).toContain("All 3 Blender 3D Shop Weapons Loaded & Equippable");
    expect(text).toContain("Air & Tree Pickup + Follow (Witch, Bat, Spider)");
    expect(text).toContain("3D Weapon Trigger VFX + Unique Weapon SFX (All 4 Tiers)");
    expect(text).toContain("Hamburger Menu (Controls, Weapons & 21 Bad Guys)");
    expect(text).toContain("Lab South Wall Blocks Player & Monsters (Left & Right)");
    expect(text).toContain("Invisible Forest Boundary Blocks All 4 Edges");
    expect(text).toContain("Hero & Monster Health + Defeat-Before-Capture + Help + Enemy Weapons");
    expect(text).toContain("Physics: Caged Bad Guy Verified Inside Cage Bounds");
    expect(text).toContain("Physics: Cage Cap Sealed on Top of Occupied Cage");
    expect(text).toContain("Performance Budget");
    expect(text).toContain("Physical Weapon Attacks (No Circle Ring; Real Projectiles & Sword Swing)");
    expect(text).toContain("Physical Enemy Attacks (Eyeball Purple Lightning, Laser Bolt & Spider Lunge)");
    expect(text).toContain("Hero HP Bar (Bottom-Right) + Enemy HP Bar (Top-Center)");
    expect(text).toContain("Physics: Caged Bad Guys Immune to Attack Knockback");
    expect(text).toContain("Witch Deleted + Killed Bad Guy Follows Into Cauldron Cage");
    expect(text).toContain("Top Row Has 4 Flying Cages + Pumpkin Next to Vampire");
    expect(text).toContain("Cat Eats Rat + Both Heads Point Forward");
    expect(text).toContain("Follow Me Toggle Makes Cat Follow Hero");
    expect(text).toContain("Bat Is Visible, Flapping & Flying in the Game");
    expect(text).toContain("Cat Head Points Forward While Following + Magical Eyeball Visible & Hovering");
  });
});
