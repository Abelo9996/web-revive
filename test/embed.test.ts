import { describe, expect, it } from "vitest";
import { parseEmbeds } from "../src/parsers/embed.js";

describe("parseEmbeds", () => {
  it("parses an <object>/<embed> Flash block with flashvars", () => {
    const html = `
      <object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="640" height="480">
        <param name="movie" value="game.swf" />
        <param name="flashvars" value="level=3&name=abel" />
        <embed src="game.swf" width="640" height="480" flashvars="level=3&name=abel"></embed>
      </object>`;
    const games = parseEmbeds(html, "https://example.com/play/");
    expect(games.length).toBe(1);
    const g = games[0]!;
    expect(g.type).toBe("flash");
    expect(g.src).toBe("https://example.com/play/game.swf");
    expect(g.width).toBe(640);
    expect(g.height).toBe(480);
    expect(g.flashvars).toEqual({ level: "3", name: "abel" });
  });

  it("parses swfobject.embedSWF calls", () => {
    const html = `<script>swfobject.embedSWF("movie.swf", "flash", "550", "400", "9.0.0");</script>`;
    const games = parseEmbeds(html, "https://host/dir/");
    expect(games[0]!.src).toBe("https://host/dir/movie.swf");
    expect(games[0]!.width).toBe(550);
    expect(games[0]!.height).toBe(400);
  });

  it("parses an <applet> tag with archive and params", () => {
    const html = `
      <applet code="com.game.Main" archive="game.jar,lib.jar" codebase="jars/" width="800" height="600">
        <param name="level" value="hard" />
      </applet>`;
    const games = parseEmbeds(html, "https://example.com/page.html");
    const g = games[0]!;
    expect(g.type).toBe("java");
    expect(g.code).toBe("com.game.Main");
    expect(g.archive).toEqual(["https://example.com/jars/game.jar", "https://example.com/jars/lib.jar"]);
    expect(g.params).toEqual({ level: "hard" });
    expect(g.width).toBe(800);
  });

  it("parses AC_FL_RunContent", () => {
    const html = `<script>AC_FL_RunContent('src','mygame','width','720','height','480','movie','mygame');</script>`;
    const games = parseEmbeds(html);
    expect(games[0]!.type).toBe("flash");
    expect(games[0]!.src).toBe("mygame.swf");
    expect(games[0]!.width).toBe(720);
  });

  it("returns nothing for a page with no game", () => {
    expect(parseEmbeds("<html><body><p>hi</p></body></html>")).toEqual([]);
  });
});
