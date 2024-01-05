describe('ServerlessAWSDocumentation', function () {
  let objectUnderTest;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    objectUnderTest = require('./fileUtils.js');
  });

  afterEach(() => {
    delete require.cache[require.resolve('./fileUtils.js')];
  });

  describe('fileUtils', () => {
    it.each`
      filename           | expected
      ${undefined}       | ${""}
      ${null}            | ${""}
      ${""}              | ${""}
      ${"test"}          | ${""}
      ${"test.ext"}      | ${"ext"}
      ${"test.json.ext"} | ${"ext"}
      ${"test.yml.ext"}  | ${"ext"}
      ${"test.yaml.ext"} | ${"ext"}
      ${"test.json"}     | ${"json"}
      ${"test.ext.json"} | ${"json"}
      ${"test.yml"}      | ${"yml"}
      ${"test.yaml"}     | ${"yaml"}
      ${"test.ext.yml"}  | ${"yml"}
      ${"test.ext.yaml"} | ${"yaml"}
    `(
      'retrieves the correct file extension for $filename',
      ({
        filename,
        expected,
      }) => {
        const result = objectUnderTest.getFileExtension(filename);

        expect(result).toBe(expected);
      },
    )

    it.each`
      extension | expected
      ${""}     | ${false}
      ${"ext"}  | ${false}
      ${"json"} | ${false}
      ${"yml"}  | ${true}
      ${"yaml"} | ${true}
    `(
      'idenfities correctly if $extension is YAML',
      ({
        extension,
        expected,
      }) => {
        const result = objectUnderTest.isYamlFileExtension(extension);

        expect(result).toBe(expected);
      },
    )
  });
});
