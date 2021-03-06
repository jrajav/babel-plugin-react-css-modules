// @flow

import {
  dirname,
  resolve
} from 'path';
import {
  readFileSync
} from 'fs';
import postcss from 'postcss';
import genericNames from 'generic-names';
import ExtractImports from 'postcss-modules-extract-imports';
import LocalByDefault from 'postcss-modules-local-by-default';
import Parser from 'postcss-modules-parser';
import Scope from 'postcss-modules-scope';
import Values from 'postcss-modules-values';
import type {
  GenerateScopedNameConfigurationType,
  StyleModuleMapType
} from './types';

// eslint-disable-next-line flowtype/no-weak-types
type FiletypePluginWithOptionsType = [string, Object];

type FiletypeOptionsType = {|
  +syntax: string,
  +plugins?: $ReadOnlyArray<string | FiletypePluginWithOptionsType>
|};

type FiletypesConfigurationType = {
  [key: string]: FiletypeOptionsType
};

const getFiletypeOptions = (cssSourceFilePath: string, filetypes: FiletypesConfigurationType): ?FiletypeOptionsType => {
  const extension = cssSourceFilePath.substr(cssSourceFilePath.lastIndexOf('.'));
  const filetype = filetypes ? filetypes[extension] : null;

  return filetype;
};

// eslint-disable-next-line flowtype/no-weak-types
const getSyntax = (filetypeOptions: FiletypeOptionsType): ?(Function | Object) => {
  if (!filetypeOptions || !filetypeOptions.syntax) {
    return null;
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(filetypeOptions.syntax);
};

// eslint-disable-next-line flowtype/no-weak-types
const getExtraPlugins = (filetypeOptions: ?FiletypeOptionsType): $ReadOnlyArray<*> => {
  if (!filetypeOptions || !filetypeOptions.plugins) {
    return [];
  }

  return filetypeOptions.plugins.map((plugin) => {
    if (typeof plugin === 'string') {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(plugin);
    } else {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(plugin[0])(plugin[1]);
    }
  });
};

const getTokens = (runner, cssSourceFilePath: string, filetypeOptions: ?FiletypeOptionsType): StyleModuleMapType => {
  // eslint-disable-next-line flowtype/no-weak-types
  const options: Object = {
    from: cssSourceFilePath
  };

  if (filetypeOptions) {
    options.syntax = getSyntax(filetypeOptions);
  }

  const lazyResult = runner
    .process(readFileSync(cssSourceFilePath, 'utf-8'), options);

  lazyResult
    .warnings()
    .forEach((message) => {
      // eslint-disable-next-line no-console
      console.warn(message.text);
    });

  return lazyResult.root.tokens;
};

type OptionsType = {|
  filetypes: FiletypesConfigurationType,
  generateScopedName?: GenerateScopedNameConfigurationType,
  context?: string
|};

export default (cssSourceFilePath: string, options: OptionsType): StyleModuleMapType => {
  // eslint-disable-next-line prefer-const
  let runner;

  let generateScopedName;

  if (options.generateScopedName && typeof options.generateScopedName === 'function') {
    generateScopedName = options.generateScopedName;
  } else {
    generateScopedName = genericNames(options.generateScopedName || '[path]___[name]__[local]___[hash:base64:5]', {
      context: options.context || process.cwd()
    });
  }

  const filetypeOptions = getFiletypeOptions(cssSourceFilePath, options.filetypes);

  const fetch = (to: string, from: string) => {
    const fromDirectoryPath = dirname(from);
    const toPath = resolve(fromDirectoryPath, to);

    return getTokens(runner, toPath, filetypeOptions);
  };

  const extraPlugins = getExtraPlugins(filetypeOptions);

  const plugins = [
    ...extraPlugins,
    Values,
    LocalByDefault,
    ExtractImports,
    new Scope({
      generateScopedName
    }),
    new Parser({
      fetch
    })
  ];

  runner = postcss(plugins);

  return getTokens(runner, cssSourceFilePath, filetypeOptions);
};
