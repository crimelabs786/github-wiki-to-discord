import { getInput, error, debug, info } from "@actions/core";
import { Client, MessageEmbed, TextChannel } from "discord.js";
import * as glob from "@actions/glob";
import fromMarkdown from "mdast-util-from-markdown";
import toMarkdown from "mdast-util-to-markdown";
import compact from "mdast-util-compact";
import { readFileSync } from "fs";
import { Content, Root } from "mdast";
import { basename, extname } from "path";
import { Color, truncate, wipeChannel } from "./util";

async function run() {
  const discordToken = getInput("discord_token");
  const discordChannel = getInput("discord_channel");
  const wikiTitle = getInput("wiki_title");
  const wikiDesc = getInput("wiki_description");
  const wikiIcon = getInput("wiki_icon_url");
  const globber = await glob.create(getInput("wiki_folder_glob"), {
    omitBrokenSymbolicLinks: true,
  });
  const githubRepoUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  const githubRepoBranch = basename(process.env.GITHUB_REF);
  const discordClient = new Client();
  const colors = new Color();
  const initialWikiEmbed = new MessageEmbed()
    .setTitle(wikiTitle)
    .setDescription(wikiDesc)
    .setColor(colors.next())

  if (wikiIcon) {
    initialWikiEmbed.setThumbnail(wikiIcon);
  }

  const embeds = [initialWikiEmbed];

  for await (const file of globber.globGenerator()) {
    const markdown = await readFileSync(file, "utf-8");
    info(`Processing: ${file}`);
    /**
     * There are few assumptions made for the structure of the wiki.
     * 1. It should have a top heading. If not, file title would be used as a supplement.
     * 2. It should have a small summary underneath. We are taking everything that is under top heading until next heading and stripping it down to fit discord.
     * 3. It should not contain any non-readable markdown elements for discord.
     */
    const tree = compact(fromMarkdown(markdown)) as Root;
    let title = basename(file, extname(file));

    const topLevelHeadingExist = tree.children[0].type === "heading";

    if (topLevelHeadingExist) {
      title = String((tree.children[0].children as Content[])[0].value);
    }

    let firstHeading = false;
    const restOfTheChildren = topLevelHeadingExist
      ? tree.children.slice(1)
      : tree.children;
    const contentUntilNextHeading = restOfTheChildren.filter((item) => {
      if (firstHeading) return false;
      if (item.type === "heading") {
        firstHeading = true;
        return false;
      }
      return true;
    });

    const path = file.split("/").slice(6).join("/");

    const readUrl = `${githubRepoUrl}/blob/${githubRepoBranch}/${path}`;
    debug(`Read url for ${file} is at: ${readUrl}`);

    let editUrl = `${githubRepoUrl}/edit/${githubRepoBranch}/${path}`;
    debug(`Edit url for ${file} is at: ${editUrl}`);

    const content = toMarkdown({
      type: "root",
      children: contentUntilNextHeading,
    });
    const description = [
      truncate(content, 1600, "..."),
      `📰 [Read more](${readUrl}) | ✏️ [Edit](${editUrl})`,
    ].join("\n\n");

    const embed = new MessageEmbed()
      .setTitle(title)
      .setDescription(description)
      .setURL(readUrl)
      .setColor(colors.next());

    embeds.push(embed);
  }

  discordClient.once("ready", async () => {
    const channel = discordClient.channels.resolve(
      discordChannel
    ) as TextChannel;

    if (!(channel.type === "text")) {
      throw new Error("Please provide a text channel.");
    }

    info(`Wiping channel: ${channel.name} in ${channel.guild.name}`);

    await wipeChannel(channel).catch(error);

    info(`${channel.name} channel wiped`);

    for (const embed of embeds) {
      await channel.send(embed);
    }

    let wikiUrl = `${githubRepoUrl}/tree/${githubRepoBranch}/${
      globber.getSearchPaths()[0].split("/").slice(6).join("/")
    }`;

    info(`Wiki url is at: ${wikiUrl}`);

    await channel.send(`You can find our wiki in full here: ${wikiUrl}`);

    info(`Logging out...`);

    discordClient.destroy();
  });

  discordClient.login(discordToken);
}

run().catch((err) => {
  error(err);
  process.exit(1);
});
