import { Collection, Message, TextChannel } from "discord.js";

export async function wipeChannel(channel: TextChannel) {
  let fetched: Collection<string, Message>;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    await channel.bulkDelete(fetched);
  } while (fetched.size >= 2);
}

export class Color {
  private _next = 0;
  static readonly options = {
    orange: "#FF5733",
    green: "#33FF70",
    blue: "#3387FF",
    pink: "#FF7EFA",
    red: "#F95B74",
    purple: "#9975FF",
    cyan: "#92F5FF",
    yellow: "#FCEE74",
    darkGray: "#5B5B5B",
  };
  static random() {
    const values = Color.toValues();
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
  }
  static toValues() {
    return Object.values(Color.options);
  }
  public next() {
    const values = Color.toValues();
    if (this._next >= values.length) {
        this._next = 0;
        return values[this._next];
    }
    const color = values[this._next];
    this._next++
    return color 
  }
}

export function truncate(text: string, max: number, suffix: string) {
  return text.length < max
    ? text
    : `${text.substr(
        0,
        text.substr(0, max - suffix.length).lastIndexOf(" ")
      )}${suffix}`;
}
