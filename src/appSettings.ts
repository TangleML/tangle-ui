import { BASE_URL } from "./utils/constants";

// Settings: Default values and local storage configuration keys
const COMPONENT_LIBRARY_FILE = "component_library.yaml";

const COMPONENT_LIBRARY_URL_DEFAULT_VALUE =
  import.meta.env.VITE_COMPONENT_LIBRARY_URL_DEFAULT_VALUE ||
  BASE_URL + COMPONENT_LIBRARY_FILE;
const COMPONENT_LIBRARY_URL_LOCAL_STORAGE_KEY =
  "ComponentLibrary/component_library_url";

const PIPELINE_LIBRARY_URL_DEFAULT_VALUE = BASE_URL + "pipeline_library.yaml";
const PIPELINE_LIBRARY_URL_LOCAL_STORAGE_KEY =
  "PipelineLibrary/pipeline_library_url";

// TODO: Remove this setting in favor of taking the first pipeline from the pipeline library
const DEFAULT_PIPELINE_URL_DEFAULT_VALUE =
  "https://raw.githubusercontent.com/Ark-kun/pipelines/2edfd25b5ee3a4aa149c24a225a50041fbd3662d/components/XGBoost/_samples/sample_pipeline.pipeline.component.yaml";
const DEFAULT_PIPELINE_URL_LOCAL_STORAGE_KEY = "App/default_pipeline_url";

const COMPONENT_FEED_URLS_DEFAULT_VALUE = [
  "https://raw.githubusercontent.com/Ark-kun/pipeline_components/pipeline_component_feed/pipeline_component_feed.yaml",
];
const COMPONENT_FEED_URLS_LOCAL_STORAGE_KEY =
  "ComponentSearch/component_feed_urls";

const GITHUB_SEARCH_LOCATIONS_DEFAULT_VALUE: string[] = [
  /*
    GitHub Search integration is currently not functioning.
    Leaving this array empty will skip Github search and avoid any errors.
  */
  // "repo:Ark-kun/pipeline_components path:components",
];
const GITHUB_SEARCH_LOCATIONS_LOCAL_STORAGE_KEY =
  "ComponentSearch/github_search_locations";

const GOOGLE_CLOUD_OAUTH_CLIENT_ID_DEFAULT_VALUE =
  "640001104961-2m8hs192tmd9f9nssbr5thr5o3uhmita.apps.googleusercontent.com";
const GOOGLE_CLOUD_OAUTH_CLIENT_ID_LOCAL_STORAGE_KEY =
  "GoogleCloud/google_cloud_oauth_client_id";

// Settings interfaces and classes
interface Setting<T> {
  get value(): T;
  set value(value: T);
  resetToDefault(): T;
  isOverridden(): boolean;
}

abstract class SettingBackedByLocalStorage<T> implements Setting<T> {
  _defaultValue: T;
  _storageKey: string;

  constructor(storageKey: string, defaultValue: T) {
    this._defaultValue = defaultValue;
    this._storageKey = storageKey;
  }

  get value() {
    // Defensive programming.
    // The window.localStorage should never be missing, null or undefined.
    // And localStorage.getItem should never fail.
    // However in practice there are reports of failures on the Internet for one reason or another.
    // So I'm being extra cautious here.
    try {
      const stringValue = window.localStorage.getItem(this._storageKey);
      if (stringValue !== null) {
        return this.deserialize(stringValue);
      }
    } catch (err) {
      console.error(
        "window.localStorage.getItem was unavailable or threw an exception. This should not happen.",
      );
      console.error(err);
    }

    return this._defaultValue;
  }

  set value(value: T) {
    const valueString = this.serialize(value);
    const defaultValueString = this.serialize(this._defaultValue);
    if (valueString === defaultValueString) {
      window.localStorage.removeItem(this._storageKey);
    } else {
      window.localStorage.setItem(this._storageKey, valueString);
    }
  }

  abstract serialize(value: T): string;
  abstract deserialize(stringValue: string): T;

  resetToDefault() {
    window.localStorage.removeItem(this._storageKey);
    return this._defaultValue;
  }

  isOverridden() {
    return window.localStorage.getItem(this._storageKey) !== null;
  }
}

class StringSettingBackedByLocalStorage extends SettingBackedByLocalStorage<string> {
  serialize(value: string): string {
    return value;
  }
  deserialize(stringValue: string): string {
    return stringValue;
  }
}

class StringArraySettingBackedByLocalStorage extends SettingBackedByLocalStorage<
  string[]
> {
  serialize(value: string[]): string {
    return JSON.stringify(value);
  }
  deserialize(stringValue: string): string[] {
    return JSON.parse(stringValue);
  }
}

interface MutableAppSettings {
  componentLibraryUrl: Setting<string>;
  pipelineLibraryUrl: Setting<string>;
  defaultPipelineUrl: Setting<string>;
  componentFeedUrls: Setting<string[]>;
  gitHubSearchLocations: Setting<string[]>;
  googleCloudOAuthClientId: Setting<string>;
}

class AppSettingsBackedByLocalStorage implements MutableAppSettings {
  componentLibraryUrl = new StringSettingBackedByLocalStorage(
    COMPONENT_LIBRARY_URL_LOCAL_STORAGE_KEY,
    COMPONENT_LIBRARY_URL_DEFAULT_VALUE,
  );
  pipelineLibraryUrl = new StringSettingBackedByLocalStorage(
    PIPELINE_LIBRARY_URL_LOCAL_STORAGE_KEY,
    PIPELINE_LIBRARY_URL_DEFAULT_VALUE,
  );
  defaultPipelineUrl = new StringSettingBackedByLocalStorage(
    DEFAULT_PIPELINE_URL_LOCAL_STORAGE_KEY,
    DEFAULT_PIPELINE_URL_DEFAULT_VALUE,
  );
  componentFeedUrls = new StringArraySettingBackedByLocalStorage(
    COMPONENT_FEED_URLS_LOCAL_STORAGE_KEY,
    COMPONENT_FEED_URLS_DEFAULT_VALUE,
  );
  gitHubSearchLocations = new StringArraySettingBackedByLocalStorage(
    GITHUB_SEARCH_LOCATIONS_LOCAL_STORAGE_KEY,
    GITHUB_SEARCH_LOCATIONS_DEFAULT_VALUE,
  );
  googleCloudOAuthClientId = new StringSettingBackedByLocalStorage(
    GOOGLE_CLOUD_OAUTH_CLIENT_ID_LOCAL_STORAGE_KEY,
    GOOGLE_CLOUD_OAUTH_CLIENT_ID_DEFAULT_VALUE,
  );
}

interface AppSettings {
  componentLibraryUrl: string;
  pipelineLibraryUrl: string;
  defaultPipelineUrl: string;
  componentFeedUrls: string[];
  gitHubSearchLocations: string[];
  googleCloudOAuthClientId: string;
}

export const getAppSettings = (): AppSettings => {
  const mutableAppSettings = new AppSettingsBackedByLocalStorage();
  return {
    componentLibraryUrl: mutableAppSettings.componentLibraryUrl.value,
    pipelineLibraryUrl: mutableAppSettings.pipelineLibraryUrl.value,
    defaultPipelineUrl: mutableAppSettings.defaultPipelineUrl.value,
    componentFeedUrls: mutableAppSettings.componentFeedUrls.value,
    gitHubSearchLocations: mutableAppSettings.gitHubSearchLocations.value,
    googleCloudOAuthClientId: mutableAppSettings.googleCloudOAuthClientId.value,
  };
};
