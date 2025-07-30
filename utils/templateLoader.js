const fs = require("fs");
const path = require("path");

// Template loader utility
const loadTemplate = (templateName) => {
  const templatePath = path.join(
    __dirname,
    "..",
    "emails",
    `${templateName}.html`
  );
  try {
    return fs.readFileSync(templatePath, "utf8");
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    return null;
  }
};

// Template compiler utility
const compileTemplate = (template, data) => {
  if (!template) return "";

  let compiledTemplate = template;

  // Replace all placeholders with actual data
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    compiledTemplate = compiledTemplate.replace(placeholder, value || "");
  }

  return compiledTemplate;
};

module.exports = {
  loadTemplate,
  compileTemplate,
};
