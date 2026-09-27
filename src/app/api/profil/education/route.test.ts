import { describe } from "node:test";
import { crudTests } from "../../../../../tests/helpers/profile-route";

describe("Education API", () => {
  crudTests("education", 
    { institution: "MIT", degree: "BSc Computer Science", startYear: 2010, endYear: 2014 },
    [
      { institution: "" },
      { institution: "a".repeat(201) },
      { degree: "a".repeat(201) },
      { startYear: 1899 },
      { endYear: 2101 },
    ]
  );
});
