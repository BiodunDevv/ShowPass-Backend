const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

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

// Template compiler utility using Handlebars
const compileTemplate = (template, data) => {
  if (!template) return "";

  try {
    // Compile the template with Handlebars
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(data);
  } catch (error) {
    console.error("Error compiling template:", error);

    // Fallback to basic string replacement for simple templates
    let fallbackTemplate = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      fallbackTemplate = fallbackTemplate.replace(placeholder, value || "");
    }
    return fallbackTemplate;
  }
};

module.exports = {
  loadTemplate,
  compileTemplate,
};
