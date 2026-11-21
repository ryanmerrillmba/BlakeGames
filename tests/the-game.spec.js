const { test, expect } = require("@playwright/test");

test.describe("The Game — 3D Collision & Movement Tests", () => {
  test("loads cleanly, player faces forward, and cannot walk through walls, trees, or solid objects", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/the-game/index.html");
    await page.waitForFunction(() => window.__THE_GAME__ && window.__THE_GAME__.ready === true, {
      timeout: 15000,
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

  test("house test: can walk through house door and see crafting table, portal, and laser guy", async ({ page }) => {
    await page.goto("/the-game/index.html?test=house");
    const badge = page.locator("#autotest-results");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toContainText("ALL COLLISION TESTS PASSED");
    await expect(badge).toContainText("House Door + Crafting Table + Portal");
    await expect(badge).toContainText("Laser Guy");
    await expect(badge).toContainText("Real-Time Shadows + ACES ToneMapping");
    await expect(badge).toContainText("PMREM IBL Metallic Reflections");
    await expect(badge).toContainText("Bloom Post-Processing + 260 Fireflies");
    await expect(badge).toContainText("3D Hip/Shoulder Walk Pivots + Mixer");
    await expect(badge).toContainText("Lifelike Articulated Monster Rigs (21/21)");
    await expect(badge).toContainText("Stereo Background Music");
    await expect(badge).toContainText("Collision, Flashlight & 21 Monster SFX");
    await expect(badge).toContainText("Bad Guys Blocked by Solid Walls");
    await expect(badge).toContainText("Bad Guys Blocked by Trees");
    await expect(badge).toContainText("Monster Physics & Sliding Engine Active");
    await expect(badge).toContainText("All 3 Blender 3D Shop Weapons Loaded & Equippable");
    await expect(badge).toContainText("Air & Tree Pickup + Follow (Witch, Bat, Spider)");
    await expect(badge).toContainText("3D Weapon Trigger VFX + Unique Weapon SFX (All 4 Tiers)");
    await expect(badge).toContainText("Lab South Wall Blocks Player & Monsters (Left & Right)");
    await expect(badge).toContainText("Invisible Forest Boundary Blocks All 4 Edges");
  });
});
