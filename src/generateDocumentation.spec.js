describe('ServerlessAWSDocumentation', function () {
  let objectUnderTest;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    objectUnderTest = require('./generateDocumentation.js');
    objectUnderTest.customVars = {};
    objectUnderTest.fs = {
      writeFile: jest.fn(),
    };
    objectUnderTest.options = {
      outputFileName: 'openapi.json',
    };
    objectUnderTest.serverless = {
      service: {
        getAllFunctions: jest.fn(),
        getFunction: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete require.cache[require.resolve('./generateDocumentation.js')];
  });

  describe('generateDocumentation', () => {
    it.each([
      ['json'],
      ['unknown']
    ])('generates a documentation in JSON format when outputFileName extension is %s', async (outputFileExtension) => {
      const outputFileName = `openapi.${outputFileExtension}`;
      objectUnderTest.options.outputFileName = outputFileName;
      objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
      const jsonSpy = jest.spyOn(JSON, 'stringify');

      await objectUnderTest.generateDocumentation();

      const result = jsonSpy.mock.results[0].value;
      expect(jsonSpy).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith(expect.anything(), null, 2);
      expect(objectUnderTest.fs.writeFile).toHaveBeenCalledTimes(1);
      expect(objectUnderTest.fs.writeFile).toHaveBeenCalledWith(outputFileName, result);
    });

    it.each([
      ['yml'],
      ['yaml']
    ])('generates a documentation in YAML format when outputFileName extension is %s', async (outputFileExtension) => {
      const outputFileName = `openapi.${outputFileExtension}`;
      objectUnderTest.options.outputFileName = outputFileName;
      objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
      const YAML = require('yaml');
      const yamlSpy = jest.spyOn(YAML, 'stringify');

      await objectUnderTest.generateDocumentation();

      const result = yamlSpy.mock.results[0].value;
      expect(yamlSpy).toHaveBeenCalledTimes(1);
      expect(yamlSpy).toHaveBeenCalledWith(expect.anything(), { indent: 2 });
      expect(objectUnderTest.fs.writeFile).toHaveBeenCalledTimes(1);
      expect(objectUnderTest.fs.writeFile).toHaveBeenCalledWith(outputFileName, result);
    });

    it.each([
      [undefined],
      [null],
      [{}],
      [{ documentation: {} }]
    ])('generates an empty documentation when none is provided: %s', async (customVars) => {
      objectUnderTest.customVars = customVars;
      objectUnderTest.options.outputFileName = 'openapi.json';
      objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
      const jsonSpy = jest.spyOn(JSON, 'stringify');

      await objectUnderTest.generateDocumentation();

      const result = jsonSpy.mock.calls[0][0];
      expect(result).toEqual(
        {
          swagger: '2.0',
          info: {
            title: '',
            version: '1',
          },
          paths: {},
        },
      );
    });

    it.each`
      exportType     | expectedField | expectedValue
      ${undefined}   | ${'swagger'}  | ${'2.0'}
      ${null}        | ${'swagger'}  | ${'2.0'}
      ${''}          | ${'swagger'}  | ${'2.0'}
      ${'unkown'}    | ${'swagger'}  | ${'2.0'}
      ${'swagger'}   | ${'swagger'}  | ${'2.0'}
      ${'oas30'}     | ${'openapi'}  | ${'3.0.1'}
      ${'openapi30'} | ${'openapi'}  | ${'3.0.1'}
    `(
      'generates $expectedField field with $expectedValue value when exportType: $exportType',
      async ({
        exportType,
        expectedField,
        expectedValue,
      }) => {
        objectUnderTest.options.exportType = exportType;
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result[expectedField]).toBe(expectedValue);
      },
    );

    it.each`
      info                                            | expected
      ${undefined}                                    | ${{title: '', version: '1'}}
      ${null}                                         | ${{title: '', version: '1'}}
      ${{}}                                           | ${{title: '', version: '1'}}
      ${{title: 'any-title'}}                         | ${{title: 'any-title', version: '1'}} 
      ${{title: 'any-title', version: 'any-version'}} | ${{title: 'any-title', version: 'any-version'}} 
      ${{version: 'any-version'}}                     | ${{title: '', version: 'any-version'}} 
    `(
      'generates info field when this is passed: $info',
      async ({
        info,
        expected,
      }) => {
        objectUnderTest.customVars.documentation = { api: { info: info } };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.info).toEqual(expected);
      },
    );

    it.each`
      events                                                                                                                                   | expected
      ${undefined}                                                                                                                             | ${{}}
      ${null}                                                                                                                                  | ${{}}
      ${[]}                                                                                                                                    | ${{}}
      ${[{}]}                                                                                                                                  | ${{}}
      ${[{ unknown: {} }]}                                                                                                                     | ${{}}
      ${[{ unknown: { path: 'any/path', method: 'get', documentation: {} } }]}                                                                 | ${{}}
      ${[{ http: { path: 'any/path', method: 'get' } }]}                                                                                       | ${{}}
      ${[{ http: { path: 'any/path', method: 'get', documentation: {} } }]}                                                                    | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'GET', documentation: {} } }]}                                                                    | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'delete', documentation: {} } }]}                                                                 | ${{'/any/path': { delete: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'DELETE', documentation: {} } }]}                                                                 | ${{'/any/path': { delete: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'head', documentation: {} } }]}                                                                   | ${{'/any/path': { head: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'HEAD', documentation: {} } }]}                                                                   | ${{'/any/path': { head: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'patch', documentation: {} } }]}                                                                  | ${{'/any/path': { patch: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'PATCH', documentation: {} } }]}                                                                  | ${{'/any/path': { patch: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'post', documentation: {} } }]}                                                                   | ${{'/any/path': { post: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'POST', documentation: {} } }]}                                                                   | ${{'/any/path': { post: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'put', documentation: {} } }]}                                                                    | ${{'/any/path': { put: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'PUT', documentation: {} } }]}                                                                    | ${{'/any/path': { put: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: { unknown: 'any-value' } } }]}                                              | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {} } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: { tags: ['any-tag'] } } }]}                                                 | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {}, tags: ['any-tag'] } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: { summary: 'any-summary' } } }]}                                            | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {}, summary: 'any-summary' } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: { description: 'any-description' } } }]}                                    | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {}, description: 'any-description' } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: { deprecated: true } } }]}                                                  | ${{'/any/path': { get: { operationId: 'AnyFunction', responses: {}, deprecated: true } } }}
      ${[{ http: { path: 'any/path', method: 'get', documentation: {} } }, { http: { path: 'any/path', method: 'post', documentation: {} } }]} | ${{'/any/path': { post: { operationId: 'AnyFunction', responses: {} } } }}
    `(
      'generates paths field when events: $events',
      async ({
        events,
        expected,
      }) => {
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue(['AnyFunction']);
        objectUnderTest.serverless.service.getFunction.mockReturnValue({ events: events });
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.paths).toEqual(expected);
        expect(objectUnderTest.serverless.service.getAllFunctions).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledWith('AnyFunction');
      },
    );

    it.each`
      exportType   | methodResponses                                                                                                                   | expected
      ${'swagger'} | ${undefined}                                                                                                                      | ${{}}
      ${'swagger'} | ${null}                                                                                                                           | ${{}}
      ${'swagger'} | ${[]}                                                                                                                             | ${{}}
      ${'swagger'} | ${[{}]}                                                                                                                           | ${{}}
      ${'swagger'} | ${[{ statusCode: 200 }]}                                                                                                          | ${{ '200': { description: 'Status 200 response' } }}
      ${'swagger'} | ${[{ statusCode: 300 }]}                                                                                                          | ${{ '300': { description: 'Status 300 response' } }}
      ${'swagger'} | ${[{ statusCode: 400 }]}                                                                                                          | ${{ '400': { description: 'Status 400 response' } }}
      ${'swagger'} | ${[{ statusCode: 500 }]}                                                                                                          | ${{ '500': { description: 'Status 500 response' } }}
      ${'swagger'} | ${[{ statusCode: 200 }, { statusCode: 500 }]}                                                                                     | ${{ '200': { description: 'Status 200 response' }, '500': { description: 'Status 500 response' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseBody: null }]}                                                                                      | ${{ '200': { description: 'Status 200 response' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseBody: {} }]}                                                                                        | ${{ '200': { description: 'Status 200 response' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseBody: { description: 'any-description' } }]}                                                        | ${{ '200': { description: 'any-description' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseModels: null }]}                                                                                    | ${{ '200': { description: 'Status 200 response' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseModels: {} }]}                                                                                      | ${{ '200': { description: 'Status 200 response', content: {} } }}
      ${'swagger'} | ${[{ statusCode: 200, responseModels: { 'application/json': 'AnyModel' } }]}                                                      | ${{ '200': { description: 'Status 200 response', content: { 'application/json': { 'schema': { '$ref': '#/components/schemas/AnyModel' } } } } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: null }]}                                                                                   | ${{ '200': { description: 'Status 200 response' } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [] }]}                                                                                     | ${{ '200': { description: 'Status 200 response', headers: {} } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [{}] }]}                                                                                   | ${{ '200': { description: 'Status 200 response', headers: {} } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header' }] }]}                                                               | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': {} } } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header', description: 'any-description', type: 'any-type' }] }]}             | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': { description: 'any-description', type: 'any-type' } } } }}
      ${'oas30'}   | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header', description: 'any-description', type: 'any-type' }] }]}             | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': { description: 'any-description', schema: { type: 'any-type' } } } } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header', description: 'any-description', schema: { type: 'any-type' } }] }]} | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': { description: 'any-description', type: 'any-type' } } } }}
      ${'oas30'}   | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header', description: 'any-description', schema: { type: 'any-type' } }] }]} | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': { description: 'any-description', schema: { type: 'any-type' } } } } }}
      ${'swagger'} | ${[{ statusCode: 200, responseHeaders: [{ name: 'any-header' }, { name: 'any-other-header' }] }]}                                 | ${{ '200': { description: 'Status 200 response', headers: { 'any-header': {}, 'any-other-header': {} } } }}
    `(
      'generates paths.PATH.METHOD.responses field when exportType: $exportType and event methodResponses: $methodResponses',
      async ({
        exportType,
        methodResponses,
        expected,
      }) => {
        objectUnderTest.options.exportType = exportType;
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue(['AnyFunction']);
        objectUnderTest.serverless.service.getFunction.mockReturnValue({
          events: [{ http: { path: 'any/path', method: 'get', documentation: { methodResponses: methodResponses } } }]
        });
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.paths['/any/path'].get.responses).toEqual(expected);
        expect(objectUnderTest.serverless.service.getAllFunctions).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledWith('AnyFunction');
      },
    );

    it.each`
      exportType   | httpEvent                                                                                                                                                                               | expected
      ${'swagger'} | ${{}}                                                                                                                                                                                   | ${undefined}
      ${'swagger'} | ${{ queryParams: null }}                                                                                                                                                                | ${undefined}
      ${'swagger'} | ${{ queryParams: [] }}                                                                                                                                                                  | ${[]}
      ${'swagger'} | ${{ queryParams: [{}] }}                                                                                                                                                                | ${[]}
      ${'swagger'} | ${{ queryParams: [{ name: 'any-name' }] }}                                                                                                                                              | ${[{ name: 'any-name', in: 'query' }]}
      ${'swagger'} | ${{ queryParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                          | ${[{ name: 'any-name', in: 'query', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ queryParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                          | ${[{ name: 'any-name', in: 'query', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ queryParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                              | ${[{ name: 'any-name', in: 'query', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ queryParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                              | ${[{ name: 'any-name', in: 'query', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ queryParams: [{ name: 'any-name' }, { name: 'any-other-name' }] }}                                                                                                                  | ${[{ name: 'any-name', in: 'query' }, { name: 'any-other-name', in: 'query' }]}
      ${'swagger'} | ${{ pathParams: null }}                                                                                                                                                                 | ${undefined}
      ${'swagger'} | ${{ pathParams: [] }}                                                                                                                                                                   | ${[]}
      ${'swagger'} | ${{ pathParams: [{}] }}                                                                                                                                                                 | ${[]}
      ${'swagger'} | ${{ pathParams: [{ name: 'any-name' }] }}                                                                                                                                               | ${[{ name: 'any-name', in: 'path', required: true }]}
      ${'swagger'} | ${{ pathParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                           | ${[{ name: 'any-name', in: 'path', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ pathParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                           | ${[{ name: 'any-name', in: 'path', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ pathParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                               | ${[{ name: 'any-name', in: 'path', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ pathParams: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                               | ${[{ name: 'any-name', in: 'path', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ pathParams: [{ name: 'any-name' }, { name: 'any-other-name' }] }}                                                                                                                   | ${[{ name: 'any-name', in: 'path', required: true }, { name: 'any-other-name', in: 'path', required: true }]}
      ${'swagger'} | ${{ requestBody: null }}                                                                                                                                                                | ${undefined}
      ${'swagger'} | ${{ requestBody: {} }}                                                                                                                                                                  | ${[{ name: '', in: 'body', schema: {} }]}
      ${'oas30'}   | ${{ requestBody: {} }}                                                                                                                                                                  | ${undefined}
      ${'swagger'} | ${{ requestBody: { description: 'any-description' } }}                                                                                                                                  | ${[{ name: '', in: 'body', description: 'any-description', schema: {} }]}
      ${'swagger'} | ${{ requestBody: { description: 'any-description' }, requestModels: null }}                                                                                                             | ${[{ name: '', in: 'body', description: 'any-description', schema: {} }]}
      ${'swagger'} | ${{ requestBody: { description: 'any-description' }, requestModels: {} }}                                                                                                               | ${[{ name: '', in: 'body', description: 'any-description', schema: {} }]}
      ${'swagger'} | ${{ requestBody: { description: 'any-description' }, requestModels: { 'application/json': 'AnyModel' } }}                                                                               | ${[{ name: 'AnyModel', in: 'body', description: 'any-description', schema: { '$ref': '#/components/schemas/AnyModel' } }]}
      ${'oas30'}   | ${{ requestBody: { description: 'any-description' }, requestModels: { 'application/json': 'AnyModel' } }}                                                                               | ${undefined}
      ${'swagger'} | ${{ requestHeaders: null }}                                                                                                                                                             | ${undefined}
      ${'swagger'} | ${{ requestHeaders: [] }}                                                                                                                                                               | ${[]}
      ${'swagger'} | ${{ requestHeaders: [{}] }}                                                                                                                                                             | ${[]}
      ${'swagger'} | ${{ requestHeaders: [{ name: 'any-name' }] }}                                                                                                                                           | ${[{ name: 'any-name', in: 'header' }]}
      ${'swagger'} | ${{ requestHeaders: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                       | ${[{ name: 'any-name', in: 'header', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ requestHeaders: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, type: 'any-type' }] }}                                                       | ${[{ name: 'any-name', in: 'header', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ requestHeaders: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                           | ${[{ name: 'any-name', in: 'header', description: 'any-description', required: true, deprecated: true, type: 'any-type' }]}
      ${'oas30'}   | ${{ requestHeaders: [{ name: 'any-name', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }] }}                                           | ${[{ name: 'any-name', in: 'header', description: 'any-description', required: true, deprecated: true, schema: { type: 'any-type' } }]}
      ${'swagger'} | ${{ requestHeaders: [{ name: 'any-name' }, { name: 'any-other-name' }] }}                                                                                                               | ${[{ name: 'any-name', in: 'header' }, { name: 'any-other-name', in: 'header' }]}
      ${'swagger'} | ${{ queryParams: [{ name: 'any-query-name' }], pathParams: [{ name: 'any-path-name' }], requestBody: {}, requestHeaders: [{ name: 'any-header-name' }] }}                               | ${[{ name: 'any-query-name', in: 'query' }, { name: 'any-path-name', in: 'path', required: true }, { name: 'any-header-name', in: 'header' }, { name: '', in: 'body', schema: {} }]}
      ${'oas30'} | ${{ queryParams: [{ name: 'any-query-name' }], pathParams: [{ name: 'any-path-name' }], requestBody: { description: 'any-description' }, requestHeaders: [{ name: 'any-header-name' }] }} | ${[{ name: 'any-query-name', in: 'query', schema: {} }, { name: 'any-path-name', in: 'path', required: true, schema: {} }, { name: 'any-header-name', in: 'header', schema: {} }]}
    `(
      'generates paths.PATH.METHOD.parameters field when exportType: $exportType and event: $httpEvent',
      async ({
        exportType,
        httpEvent,
        expected,
      }) => {
        objectUnderTest.options.exportType = exportType;
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue(['AnyFunction']);
        objectUnderTest.serverless.service.getFunction.mockReturnValue({
          events: [{ http: { path: 'any/path', method: 'get', documentation: httpEvent } }]
        });
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.paths['/any/path'].get.parameters).toEqual(expected);
        expect(objectUnderTest.serverless.service.getAllFunctions).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledWith('AnyFunction');
      },
    );

    it.each`
      exportType   | httpEvent                                                                                                 | expected
      ${'oas30'}   | ${{}}                                                                                                     | ${undefined}
      ${'oas30'}   | ${{ requestBody: null }}                                                                                  | ${undefined}
      ${'oas30'}   | ${{ requestBody: {} }}                                                                                    | ${{ content: {} }}
      ${'oas30'}   | ${{ requestBody: { unknown: 'any-unknown-field' } }}                                                      | ${{ content: {} }}
      ${'oas30'}   | ${{ requestBody: { description: 'any-description' } }}                                                    | ${{ description: 'any-description', content: {} }}
      ${'oas30'}   | ${{ requestBody: { description: 'any-description' }, requestModels: { 'application/json': 'AnyModel' } }} | ${{ description: 'any-description', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AnyModel' } } } }}
      ${'swagger'} | ${{ requestBody: { description: 'any-description' }, requestModels: { 'application/json': 'AnyModel' } }} | ${undefined}
    `(
      'generates paths.PATH.METHOD.requestBody field when exportType: $exportType and event: $httpEvent',
      async ({
        exportType,
        httpEvent,
        expected,
      }) => {
        objectUnderTest.options.exportType = exportType;
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue(['AnyFunction']);
        objectUnderTest.serverless.service.getFunction.mockReturnValue({
          events: [{ http: { path: 'any/path', method: 'get', documentation: httpEvent } }]
        });
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.paths['/any/path'].get.requestBody).toEqual(expected);
        expect(objectUnderTest.serverless.service.getAllFunctions).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledTimes(1);
        expect(objectUnderTest.serverless.service.getFunction).toHaveBeenCalledWith('AnyFunction');
      },
    );

    it.each`
      models                                                                                         | expected
      ${undefined}                                                                                   | ${undefined}
      ${null}                                                                                        | ${undefined}
      ${[]}                                                                                          | ${undefined}
      ${[{}]}                                                                                        | ${undefined}
      ${[{ name: 'AnyModel' }]}                                                                      | ${undefined}
      ${[{ schema: { type: 'any-type' } }]}                                                          | ${undefined}
      ${[{ name: 'AnyModel', schema: { type: 'any-type' } }]}                                        | ${{ 'AnyModel': { type: 'any-type' } }}
      ${[{ name: 'AnyModel', contentType: 'application/json', schema: { type: 'any-type' } }]}       | ${{ 'AnyModel': { type: 'any-type' } }}
      ${[{ name: 'AnyModel', schema: { type: 'any-type' } }, { name: 'AnyOtherModel', schema: {} }]} | ${{ 'AnyModel': { type: 'any-type' }, 'AnyOtherModel': {} }}
      ${[{ name: 'AnyModel', schema: { type: 'array', items: { '$ref': 'http://path/to/AnyOtherModel' } } }]}                                               | ${{ 'AnyModel': { type: 'array', items: { '$ref': 'http://path/to/AnyOtherModel' } } }}
      ${[{ name: 'AnyModel', schema: { type: 'array', items: { '$ref': '{{model: AnyOtherModel}}' } } }]}                                                   | ${{ 'AnyModel': { type: 'array', items: { '$ref': '#/components/schemas/AnyOtherModel' } } }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { type: 'string', default: '' } } } }]}                          | ${{ 'AnyModel': { type: 'object', required: ['id'], properties: { id: { type: 'string', default: '' } } } }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, exclusiveMinimum: false } } } }]} | ${{ 'AnyModel': { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, exclusiveMinimum: false } } } }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { '$ref': '{{model: AnyOtherModel}}' } } } }]}                   | ${{ 'AnyModel': { type: 'object', required: ['id'], properties: { id: { '$ref': '#/components/schemas/AnyOtherModel' } } } }}
      ${[{ name: 'AnyModel', schema: { type: 'object', properties: { ids: { type: 'array', items: { '$ref': '{{model: AnyOtherModel}}' } } } } }]}          | ${{ 'AnyModel': { type: 'object', properties: { ids: { type: 'array', items: { '$ref': '#/components/schemas/AnyOtherModel' } } } } }}
    `(
      'generates definitions field when exportType: swagger and models: $models',
      async ({
        models,
        expected,
      }) => {
        objectUnderTest.options.exportType = 'swagger';
        objectUnderTest.customVars.documentation = { models: models };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.definitions).toEqual(expected);
      },
    );

    it.each`
      models                                                                                         | expected
      ${undefined}                                                                                   | ${undefined}
      ${null}                                                                                        | ${undefined}
      ${[]}                                                                                          | ${undefined}
      ${[{}]}                                                                                        | ${undefined}
      ${[{ name: 'AnyModel' }]}                                                                      | ${undefined}
      ${[{ schema: { type: 'any-type' } }]}                                                          | ${undefined}
      ${[{ name: 'AnyModel', schema: { type: 'any-type' } }]}                                        | ${{ schemas: { 'AnyModel': { type: 'any-type' } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', contentType: 'application/json', schema: { type: 'any-type' } }]}       | ${{ schemas: { 'AnyModel': { type: 'any-type' } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'any-type' } }, { name: 'AnyOtherModel', schema: {} }]} | ${{ schemas: { 'AnyModel': { type: 'any-type' }, 'AnyOtherModel': {} }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'array', items: { '$ref': 'http://path/to/AnyOtherModel' } } }]}                                               | ${{ schemas: { 'AnyModel': { type: 'array', items: { '$ref': 'http://path/to/AnyOtherModel' } } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'array', items: { '$ref': '{{model: AnyOtherModel}}' } } }]}                                                   | ${{ schemas: { 'AnyModel': { type: 'array', items: { '$ref': '#/components/schemas/AnyOtherModel' } } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { type: 'string', default: '', nullable: false } } } }]}         | ${{ schemas: { 'AnyModel': { type: 'object', required: ['id'], properties: { id: { type: 'string', default: '', nullable: false } } } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, exclusiveMinimum: false } } } }]} | ${{ schemas: { 'AnyModel': { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, exclusiveMinimum: false } } } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'object', required: ['id'], properties: { id: { '$ref': '{{model: AnyOtherModel}}' } } } }]}                   | ${{ schemas: { 'AnyModel': { type: 'object', required: ['id'], properties: { id: { '$ref': '#/components/schemas/AnyOtherModel' } } } }, securitySchemes: {} }}
      ${[{ name: 'AnyModel', schema: { type: 'object', properties: { ids: { type: 'array', items: { '$ref': '{{model: AnyOtherModel}}' } } } } }]}          | ${{ schemas: { 'AnyModel': { type: 'object', properties: { ids: { type: 'array', items: { '$ref': '#/components/schemas/AnyOtherModel' } }} } }, securitySchemes: {} }}
    `(
      'generates components.schemas field when exportType: oas30 and models: $models',
      async ({
        models,
        expected,
      }) => {
        objectUnderTest.options.exportType = 'oas30';
        objectUnderTest.customVars.documentation = { models: models };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.components).toEqual(expected);
      },
    );

    it.each`
      securitySchemes                                                   | expected
      ${undefined}                                                      | ${undefined}
      ${null}                                                           | ${undefined}
      ${{}}                                                             | ${{}}
      ${{ sc1: { type: 'any-type', name: 'any-name', in: 'header' } }}  | ${{ sc1: { type: 'any-type', name: 'any-name', in: 'header' } }}
      ${{ sc1: { type: 'any-type' }, sc2: { type: 'any-other-type' } }} | ${{ sc1: { type: 'any-type' }, sc2: { type: 'any-other-type' } }}
    `(
      'generates securityDefinitions field when exportType: swagger and securitySchemes: $securitySchemes',
      async ({
        securitySchemes,
        expected,
      }) => {
        objectUnderTest.options.exportType = 'swagger';
        objectUnderTest.customVars.documentation = { securitySchemes: securitySchemes };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.securityDefinitions).toEqual(expected);
      },
    );

    it.each`
      securitySchemes                                                   | expected
      ${undefined}                                                      | ${undefined}
      ${null}                                                           | ${undefined}
      ${{}}                                                             | ${{ schemas: {}, securitySchemes: {} }}
      ${{ sc1: { type: 'any-type', name: 'any-name', in: 'header' } }}  | ${{ schemas: {}, securitySchemes: { sc1: { type: 'any-type', name: 'any-name', in: 'header' } } }}
      ${{ sc1: { type: 'any-type' }, sc2: { type: 'any-other-type' } }} | ${{ schemas: {}, securitySchemes: { sc1: { type: 'any-type' }, sc2: { type: 'any-other-type' } } }}
    `(
      'generates components.securitySchemes field when exportType: oas30 and securitySchemes: $securitySchemes',
      async ({
        securitySchemes,
        expected,
      }) => {
        objectUnderTest.options.exportType = 'oas30';
        objectUnderTest.customVars.documentation = { securitySchemes: securitySchemes };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.components).toEqual(expected);
      },
    );

    it.each`
      tags                                                                            | expected
      ${undefined}                                                                    | ${undefined}
      ${null}                                                                         | ${undefined}
      ${[]}                                                                           | ${[]}
      ${[{name: 'any-tag'}]}                                                          | ${[{name: 'any-tag'}]}
      ${[{name: 'any-tag', description: 'any-description'}]}                          | ${[{name: 'any-tag', description: 'any-description'}]}
      ${[{name: 'any-tag', description: 'any-description'}, {name: 'any-other-tag'}]} | ${[{name: 'any-tag', description: 'any-description'}, {name: 'any-other-tag'}]}
    `(
      'generates tags field when this is passed: $tags',
      async ({
        tags,
        expected,
      }) => {
        objectUnderTest.customVars.documentation = { api: { tags: tags } };
        objectUnderTest.serverless.service.getAllFunctions.mockReturnValue([]);
        const jsonSpy = jest.spyOn(JSON, 'stringify');

        await objectUnderTest.generateDocumentation();

        const result = jsonSpy.mock.calls[0][0];
        expect(result.tags).toEqual(expected);
      },
    );
  });
});

