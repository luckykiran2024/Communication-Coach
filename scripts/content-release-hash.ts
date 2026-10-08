import { scenarios } from "@coach/core";
import { scenarioCatalogHash } from "./content-release";

console.log(JSON.stringify({ scenarioCount: scenarios.length, catalogHash: scenarioCatalogHash() }, null, 2));
