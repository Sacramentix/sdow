import _ from 'lodash';
import axios from 'axios';
import React from 'react';
import Autosuggest from 'react-autosuggest';

import {getRandomPageTitle} from '../utils';

import ArticleInputSuggestion from './ArticleInputSuggestion';

import {AutosuggestWrapper} from './ArticleInput.styles';

import {WIKIPEDIA_API_URL} from '../resources/constants';

// Autosuggest component helpers.
const getSuggestionValue = (suggestion) => suggestion.title;
const renderSuggestion = (suggestion) => <ArticleInputSuggestion {...suggestion} />;

class ArticleInput extends React.Component {
  constructor() {
    super();

    this.state = {
      suggestions: [],
      isFetching: false,
      placeholderText: getRandomPageTitle(),
    };

    this.debouncedLoadSuggestions = _.debounce(this.loadSuggestions, 250);
    this.placeholderTextInterval = setInterval(() => this.updatePlaceholderText(), 5000);
  }

  getValue() {
    const {toOrFrom, toArticleTitle, fromArticleTitle} = this.props;
    return toOrFrom === 'to' ? toArticleTitle : fromArticleTitle;
  }

  updatePlaceholderText() {
    this.setState((prevState) => ({
      placeholderText: getRandomPageTitle(prevState.placeholderText),
    }));
  }

  loadSuggestions(value) {
    this.setState({
      isFetching: true,
    });

    const queryParams = {
      action: 'query',
      format: 'json',
      gpssearch: value,
      generator: 'prefixsearch',
      prop: 'pageprops|pageimages|pageterms',
      redirects: '', // Automatically resolve redirects
      ppprop: 'displaytitle',
      piprop: 'thumbnail',
      pithumbsize: '160',
      pilimit: '30',
      wbptterms: 'description',
      gpsnamespace: '0', // Only return results in Wikipedia's main namespace
      gpslimit: 5, // Return at most five results
      origin: '*',
    };

    // TODO: add helper for making API requests to WikiMedia API
    axios({
      method: 'get',
      url: WIKIPEDIA_API_URL,
      params: queryParams,
      headers: {
        'Api-User-Agent':
          'Six Degrees of Wikipedia/1.0 (https://www.sixdegreesofwikipedia.com/; wenger.jacob@gmail.com)',
      },
    })
      .then((response) => {
        const suggestions = [];

        const pageResults = _.get(response, 'data.query.pages', {});
        _.forEach(pageResults, ({index, title, terms, thumbnail}) => {
          let description = _.get(terms, 'description.0');
          if (description) {
            description = description.charAt(0).toUpperCase() + description.slice(1);
          }
          suggestions[index - 1] = {
            title,
            description,
            thumbnailUrl: _.get(thumbnail, 'source'),
          };
        });

        this.setState({
          isFetching: false,
          suggestions: suggestions,
        });
      })
      .catch((error) => {
        // TODO: add Sentry logging here (or just Google Analytics)
        // const defaultErrorMessage = 'Request to fetch article suggestions failed.';
        // const errorMessage = (_.get(error, 'response.data.error', defaultErrorMessage));
        // Don't report any user-facing error since the input is still usable without suggestions.
      });
  }

  render() {
    const {suggestions, placeholderText} = this.state;
    const {toOrFrom, setArticleTitle} = this.props;
    const value = this.getValue();

    return (
      <AutosuggestWrapper>
        <Autosuggest
          suggestions={suggestions}
          onSuggestionsFetchRequested={({value}) => {
            this.debouncedLoadSuggestions(value);
          }}
          onSuggestionsClearRequested={() => {
            this.setState({
              suggestions: [],
            });
          }}
          getSuggestionValue={getSuggestionValue}
          renderSuggestion={renderSuggestion}
          inputProps={{
            placeholder: placeholderText,
            onChange: (event, {newValue}) => {
              setArticleTitle(toOrFrom, newValue);
              if (newValue === '') {
                this.placeholderTextInterval = setInterval(
                  () => this.updatePlaceholderText(),
                  5000
                );
              } else if (this.placeholderTextInterval !== null) {
                clearInterval(this.placeholderTextInterval);
                this.placeholderTextInterval = null;
              }
            },
            value,
          }}
        />
      </AutosuggestWrapper>
    );
  }
}

export default ArticleInput;
