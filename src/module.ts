import {
  addDevServerHandler,
  addPlugin,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit";

import collectionHandler from "./endpoints/collection.post";
import { eventHandler } from "h3";
import fieldHandler from "./endpoints/field.post";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ModuleOptions {
  /**
   * Path to a TypeScript file exporting a Directus SDK Schema type.
   * When set, the module generates a type augmentation so `$directus`
   * client methods return fully typed results.
   * Relative to the project root.
   */
  schemaPath?: string;
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxtus",
    configKey: "nuxtus",
  },
  defaults: {},
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    addPlugin(resolver.resolve("./runtime/plugin"));

    if (options.schemaPath) {
      const fullPath = resolve(nuxt.options.rootDir, options.schemaPath);
      if (!existsSync(fullPath)) {
        console.warn(
          `[nuxtus] schemaPath "${options.schemaPath}" not found at ${fullPath}. Falling back to untyped Schema.`
        );
      } else {
        addTypeTemplate({
          filename: "nuxtus-schema-augmentation.d.ts",
          write: true,
          getContents: () => {
            const relPath = options.schemaPath!.replace(/\.ts$/, "");
            return [
              `import type { Schema } from "${relPath}";`,
              `import type { DirectusClient, RestClient, StaticTokenClient, RestCommand, Query, QueryItem, CollectionType, RegularCollections, ReadItemOutput, ApplyQueryFields } from "@directus/sdk";`,
              ``,
              `type S = Schema;`,
              `type DirectusRest = DirectusClient<S> & RestClient<S>;`,
              `type DirectusRestToken = DirectusClient<S> & RestClient<S> & StaticTokenClient<S>;`,
              ``,
              `type TypedReadItems = <Collection extends RegularCollections<S>, const TQuery extends Query<S, CollectionType<S, Collection>>>(`,
              `  collection: Collection,`,
              `  query?: TQuery`,
              `) => RestCommand<ReadItemOutput<S, Collection, TQuery>[], S>;`,
              ``,
              `type TypedReadItem = <Collection extends RegularCollections<S>, const TQuery extends QueryItem<S, CollectionType<S, Collection>>>(`,
              `  collection: Collection,`,
              `  key: string | number,`,
              `  query?: TQuery`,
              `) => RestCommand<ReadItemOutput<S, Collection, TQuery>, S>;`,
              ``,
              `declare module "#app" {`,
              `  interface NuxtApp {`,
              `    $directus: DirectusRest | DirectusRestToken;`,
              `    $readItem: TypedReadItem;`,
              `    $readItems: TypedReadItems;`,
              `    $readSingleton: typeof import("@directus/sdk")["readSingleton"];`,
              `  }`,
              `}`,
              ``,
            ].join("\n");
          },
        });
      }
    }

    addDevServerHandler({
      route: "/api/directus/field",
      handler: eventHandler(fieldHandler),
    });
    addDevServerHandler({
      route: "/api/directus/collection",
      handler: eventHandler(collectionHandler),
    });
  },
});

export type { DirectusSchema } from "./runtime/schema-utils";
