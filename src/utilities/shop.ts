import axios from "axios";
import fs from "fs/promises";
import path from "path";
import Safety from "./safety.js";

interface CosmeticItem {
    name: string;
    type: { value: string };
    rarity: { value: string };
    series?: { value: string };
    images: { icon: string };
    id: string;
}

interface ItemGrant {
    templateId: string;
    quantity: number;
}

interface ShopItem {
    itemGrants: ItemGrant[];
    price: { regularPrice: number; finalPrice: number };
    shopName: string;
}

export default class Shop {
    private static catalogConfigPath = path.join(process.cwd(), "catalog_config.json");

    private static getPrice(rarity: string, series?: string): number {
        if (series) {
            if (series === "MarvelSeries" || series === "DCUSeries" || series === "StarWarsSeries") {
                return 1500;
            }
            if (series === "CreatorCollabSeries") {
                return 2000;
            }
            return 1200;
        }
        switch (rarity) {
            case "legendary":
                return 2000;
            case "epic":
                return 1500;
            case "rare":
                return 1200;
            case "uncommon":
                return 800;
            default:
                return 500;
        }
    }

    private static shuffle<T>(arr: T[]): T[] {
        return arr.sort(() => Math.random() - 0.5);
    }

    private static pickRandom<T>(arr: T[], count: number): T[] {
        return Shop.shuffle(arr).slice(0, count);
    }

    public static async updateShop(): Promise<ShopItem[]> {
        const { data } = await axios.get("https://fortnite-api.com/v2/cosmetics/br");
        const items: CosmeticItem[] = data.data;

        const maxSeason = Number(Safety.env.MAIN_SEASON);
        if (!Number.isFinite(maxSeason)) {
            throw new Error("MAIN_SEASON is not a valid number");
        }

        const filtered = items.filter((item) => {
            if (
                item.type.value === "emote" ||
                item.rarity.value === "frozen" ||
                item.name.toLowerCase().includes("banner")
            ) {
                return false;
            }

            const parts = item.id.split("_");
            const seasonPart = parseInt(parts[1] ?? "", 10);

            // If ID doesn't have a numeric part, skip
            if (!Number.isFinite(seasonPart)) return false;

            return seasonPart <= maxSeason;
        });

        const featured = Shop.pickRandom(filtered, 8).map<ShopItem>((item) => ({
            itemGrants: [{ templateId: `AthenaCharacter:${item.id}`, quantity: 1 }],
            price: {
                regularPrice: Shop.getPrice(item.rarity.value, item.series?.value),
                finalPrice: Shop.getPrice(item.rarity.value, item.series?.value)
            },
            shopName: item.name
        }));

        const daily = Shop.pickRandom(filtered, 6).map<ShopItem>((item) => ({
            itemGrants: [{ templateId: `AthenaCharacter:${item.id}`, quantity: 1 }],
            price: {
                regularPrice: Shop.getPrice(item.rarity.value, item.series?.value),
                finalPrice: Shop.getPrice(item.rarity.value, item.series?.value)
            },
            shopName: item.name
        }));

        const finalShop = [...featured, ...daily];

        await fs.writeFile(Shop.catalogConfigPath, JSON.stringify(finalShop, null, 2), "utf8");

        return finalShop;
    }
}
