'use strict';

const YAML = require('yaml');
const fileUtils = require('./fileUtils.js');

module.exports = {
  generateDocumentation: function () {
    const template = (this.customVars && this.customVars.documentation) ? this.customVars.documentation : {};
    const version = getOpenApiVersion(this.options.exportType);

    const documentation = {};
    if (version === "2.0") {
      documentation.swagger = version;
    } else {
      documentation.openapi = version;
    }
    documentation.info = generateInfo(template.api);
    documentation.paths = generatePaths(version, this.serverless.service);

    const models = generateModels(template.models);
    if (version === "2.0") {
      if (models && Object.keys(models).length > 0) {
        documentation.definitions = models;
      }
      if (template.securitySchemes) {
        documentation.securityDefinitions = template.securitySchemes;
      }
    } else {
      if ((models && Object.keys(models).length > 0) || template.securitySchemes) {
        documentation.components = {
          schemas: models,
          securitySchemes: template.securitySchemes || {},
        };
      }
    }

    if (template.api && template.api.tags) {
      documentation.tags = template.api.tags;
    }

    const extension = fileUtils.getFileExtension(this.options.outputFileName);
    let output;
    if (fileUtils.isYamlFileExtension(extension)) {
      output = YAML.stringify(documentation, { indent: 2 });
    } else {
      output = JSON.stringify(documentation, null, 2);
    }
    this.fs.writeFile(this.options.outputFileName, output);
  },
};

function getOpenApiVersion(exportType) {
  let version = "2.0";
  if (exportType === "oas30" || exportType === "openapi30") {
    version = "3.0.1";
  }

  return version;
}

function generateInfo(templateApi) {
  const defaultInfo = {
    title: '',
    version: '1',
  };
  if (!templateApi || !templateApi.info) return defaultInfo;

  const info = templateApi.info;
  Object.keys(defaultInfo).forEach((field) => {
    if (!info[field]) {
      info[field] = defaultInfo[field];
    }
  });

  return info;
}

function generatePaths(version, service) {
  const paths = {};
  service.getAllFunctions().forEach((functionName) => {
    const events = service.getFunction(functionName).events;
    if (!events) return;

    events
      .map((event) => event.http)
      .filter((httpEvent) => httpEvent && httpEvent.documentation)
      .forEach((httpEvent) => {
        paths[`/${httpEvent.path}`] = {
          [`${httpEvent.method.toLowerCase()}`]: generatePath(version, functionName, httpEvent.documentation),
        }
      });
  });

  return paths;
}

function generatePath(version, functionName, templateEvent) {
  const path = {
    operationId: functionName,
  };

  ['tags', 'summary', 'description', 'deprecated'].forEach((field) => {
    if (templateEvent[field]) {
      path[field] = templateEvent[field];
    }
  });

  const supportedParamTypes = {
    queryParams: 'query',
    pathParams: 'path',
    requestHeaders: 'header',
  };
  Object.keys(supportedParamTypes).forEach((paramType) => {
    if (templateEvent[paramType]) {
      const parameters = generateParameters(version, supportedParamTypes[paramType], templateEvent[paramType]);
      if(!path.parameters) {
        path.parameters = [];
      }
      parameters.forEach((parameter) => {
        path.parameters.push(parameter);
      });
    }
  });

  if (templateEvent.requestBody) {
    if (version === '2.0') {
      if(!path.parameters) {
        path.parameters = [];
      }
      path.parameters.push(generateBodyParameter(templateEvent.requestBody, templateEvent.requestModels));
    } else {
      path.requestBody = generateRequestBody(templateEvent.requestBody, templateEvent.requestModels);
    }
  }

  path.responses = generateResponses(version, templateEvent.methodResponses);

  return path;
}

function generateResponses(version, templateMethodResponses) {
  const responses = {};
  if (!templateMethodResponses) return responses;

  templateMethodResponses.forEach((templateResponse) => {
    if (!templateResponse.statusCode) return;

    responses[`${templateResponse.statusCode}`] = {
      description: (templateResponse.responseBody && templateResponse.responseBody.description) ?
        templateResponse.responseBody.description :
        `Status ${templateResponse.statusCode} response`,
    }

    if (templateResponse.responseModels) {
      responses[`${templateResponse.statusCode}`].content = generateResponseContent(templateResponse.responseModels);
    }

    if (templateResponse.responseHeaders) {
      responses[`${templateResponse.statusCode}`].headers = generateResponseHeaders(version, templateResponse.responseHeaders);
    }
  });

  return responses;
}

function generateResponseContent(templateResponseModels) {
  const content = {};
  if (!templateResponseModels) return content;

  Object.keys(templateResponseModels).forEach((contentType) => {
    content[contentType] = {
      schema: {
        $ref: `#/components/schemas/${templateResponseModels[contentType]}`,
      },
    };
  });

  return content;
}

function generateResponseHeaders(version, templateResponseHeaders) {
  const headers = {};
  if (!templateResponseHeaders) return headers;

  templateResponseHeaders.forEach((templateHeader) => {
    if (!templateHeader.name) return;

    headers[templateHeader.name] = {};
    if (templateHeader.description) {
      headers[templateHeader.name].description = templateHeader.description;
    }

    const schema = generateSchema(templateHeader, ['name', 'description']);
    if (version === "2.0") {
      Object.keys(schema).forEach((field) => {
        headers[templateHeader.name][field] = schema[field];
      });
    } else {
      headers[templateHeader.name].schema = schema;
    }
  });

  return headers;
}

function generateParameters(version, paramType, templateParams) {
  const parameters = [];
  if (!templateParams) return parameters;

  templateParams.forEach((templateParam) => {
    if (!templateParam.name) return;

    const parameter = {
      name: templateParam.name,
      in: paramType,
    };
    const optionalFields = [
      'description',
      'required',
      'deprecated',
      'allowEmptyValue',
      'style',
      'explode',
      'allowReserved',
      'example',
      'examples',
      'content'
    ];
    optionalFields.forEach((field) => {
      if(templateParam[field]) {
        parameter[field] = templateParam[field];
      }
    });
    if (!templateParam.required && paramType === 'path') {
      parameter.required = true;
    }

    const schema = generateSchema(templateParam, ['name'].concat(optionalFields));
    if (version === "2.0") {
      Object.keys(schema).forEach((field) => {
        parameter[field] = schema[field];
      });
    } else {
      parameter.schema = schema;
    }

    parameters.push(parameter);
  });

  return parameters;
}

function generateBodyParameter(templateRequestBody, templateRequestModels) {
  const parameter = { name: '', in: 'body', schema: {} };
  if (templateRequestBody && templateRequestBody.description) {
    parameter.description = templateRequestBody.description;
  }

  const contentTypes = (templateRequestModels) ? Object.keys(templateRequestModels) : [];
  if (contentTypes.length == 0) return parameter;

  parameter.name = templateRequestModels[contentTypes[0]];
  parameter.schema = { '$ref': `#/components/schemas/${templateRequestModels[contentTypes[0]]}` };

  return parameter;
}

function generateRequestBody(templateRequestBody, templateRequestModels) {
  const requestBody = {};
  if (templateRequestBody && templateRequestBody.description) {
    requestBody.description = templateRequestBody.description;
  }

  requestBody.content = {};
  if (templateRequestModels) {
    Object.keys(templateRequestModels).forEach((contentType) => {
      requestBody.content[contentType] = {
        schema: {
          $ref: `#/components/schemas/${templateRequestModels[contentType]}`,
        },
      };
    });
  }

  return requestBody;
}

function generateModels(templateModels) {
  const models = {};
  if (!templateModels) return models;

  templateModels.forEach((templateModel) => {
    if (!templateModel.name || !templateModel.schema) return;
    models[templateModel.name] = templateModel.schema;
  });

  return models;
}

function generateSchema(field, excludeKeys) {
  if (field.schema) return field.schema;

  const schema = {};
  Object.keys(field)
    .filter((key) => excludeKeys.indexOf(key) == -1)
    .forEach((key) => {
      schema[key] = field[key];
    });

  return schema;
}
