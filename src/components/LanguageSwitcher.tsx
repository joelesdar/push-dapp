// React + Web3 Essentials
import React, { useContext, useRef } from 'react';

// External Packages
import styled, { useTheme } from 'styled-components';
import { useTranslation } from 'react-i18next';

// Internal Components
import Dropdown, { DropdownValueType } from './Dropdown';
import { Anchor, H3, Image, Item, ItemH } from './SharedStyling.js';
import { appConfig } from 'config/index.js';
import { useClickAway } from 'hooks/useClickAway';
import { ReactComponent as EnSVG } from '../assets/en.svg';
import { ReactComponent as EsSVG } from '../assets/es.svg';

// Internal Configs
import { SpanV2 } from './reusables/SharedStylingV2';

const LanguageSwitcher = ({ isDarkMode }) => {

  // Internationalization
  const { t, i18n } = useTranslation();
  
  const toggleArrowRef = useRef(null);
  const dropdownRef = useRef(null);
  const theme = useTheme();

  const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
  const [dropdownValues, setDropdownValues] = React.useState<DropdownValueType[]>([]);

  React.useEffect(() => {
    const dropdown: DropdownValueType[] = [];
    setDropdownValues(dropdown);
  }, [appConfig]);

  useClickAway(toggleArrowRef, dropdownRef, () => {
    setShowDropdown(false);
  });

  return (
    <>
        <Container>
          <CurrentLanguage
            bg={theme.chainIndicatorBG}
            borderColor={theme.chainIndicatorBorderColor}
            isDarkMode={isDarkMode}
            onClick={() => setShowDropdown(!showDropdown)}
            ref={toggleArrowRef}
          >
            <CurrentChainInfo>
            {/* <EsSVG className='flag-icon'/> */}
              {/* will be shown only on mob devices */}
              <ChainName color={theme.chainIndicatorHeadingMobile}>Language</ChainName>
            </CurrentChainInfo>
            <ToggleArrowImg filter={theme.chainIndicatorBorderColor}>
            {i18n.language.slice(0, 2) === 'es' ? <EsSVG className='flag-icon'/> : <EnSVG className='flag-icon'/>}
              <img
                alt="arrow"
                className={`${showDropdown ? 'down' : 'up'}`}
                src="/svg/arrow.svg"
              />
            </ToggleArrowImg>
          </CurrentLanguage>
          {showDropdown && (
            <DropdownItem
              ref={dropdownRef}
              bg={theme.chainIndicatorDropdownBG}
              border={`1px solid ${theme.chainIndicatorBorderColor}`}
              radius="24px"
              align="flex-start"
              position="absolute"
              top="4.1rem"
              right="-0.5rem"
            >
              <H3
                color={theme.chainIndicatorHeading}
                margin="0px 1px 6px 0"
                textTransform="none"
                family="Strawford"
                spacing="0.01rem"
                weight="400"
                size="15px"
              >
                Select Language
              </H3>
              <Anchor
                      href="/"
                      target=""
                      title={'de vallenatos y de acordeones'}
                      bg="transparent"
                      hoverBG="#fff"
                      padding="7px 30px"
                      size="16px"
                      weight="400"
                      lineHeight="230%"
                      spacing="normal"
                      color={theme.chainIndicatorText}
                      onClick={() => i18n.changeLanguage('en')}
                    >
                      English
                    </Anchor>
                    <Anchor
                      href="/"
                      target=""
                      title={'Barranquilla ciudad de cantores'}
                      bg="transparent"
                      hoverBG="#fff"
                      padding="7px 30px"
                      size="16px"
                      weight="400"
                      lineHeight="230%"
                      spacing="normal"
                      color={theme.chainIndicatorText}
                      onClick={() => i18n.changeLanguage('es')}
                    >
                      Spanish
                    </Anchor>
            </DropdownItem>
          )}
        </Container>
    </>
  );
};

// css styles
const Container = styled.button`
  position: relative;
  margin: 0;
  padding: 0;
  background: none;
  border: 0;
  outline: 0;
  justify-content: flex-start;
  flex: 1,
  flex-direction: row;
  align-items: center;
  display: flex;
  @media (max-width: 992px) {
    width: 100%;
    margin-right: 20px;
  }
`;
const CurrentLanguage = styled(SpanV2)`
  margin: 0px 1px;
  padding: 6px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.bg};
  border: ${(props) => `1px solid ${props.borderColor}`};
  border-radius: 19px;
  ${({ isDarkMode, bg }) =>
    isDarkMode &&
    `
    background-origin: border-box;
    background-clip: content-box, border-box;
    box-shadow: 2px 1000px 1px ${bg} inset;
  `}

  &:hover {
    opacity: 0.9;
    cursor: pointer;
    pointer: hand;
  }
  &:active {
    opacity: 0.75;
    cursor: pointer;
    pointer: hand;
  }

  @media (max-width: 992px) {
    width: 100%;
    justify-content: space-between;
    border: none;
    background: none;
    margin: 10px 16px 25px 5px;
    padding: 4px 0;
  }
`;

const CurrentChainInfo = styled(ItemH)`
  justify-content: flex-start;
  flex-wrap: nowrap;
  padding: 2px;
`;

const ChainName = styled(H3)`
  display: none;
  font-family: 'Strawford';
  text-transform: none;
  margin: 10px 0 10px 15px;
  font-weight: 400;
  size: 18px;
  letter-spacing: -0.01em;
  color: black;
  cursor: pointer;

  @media (max-width: 992px) {
    display: flex;
  }
`;

const ToggleArrowImg = styled.div`
  margin-left: 0.3rem;
  margin-right: 0.2rem;
  filter: ${(props) => props.filter};
  &:hover {
    cursor: pointer;
  }
  .down {
    transform: rotate(-180deg);
    transition: transform 0.25s;
  }

  .up {
    transform: rotate(-360deg);
    transition: transform 0.25s;
  }
  // Styles for the flags
  .flag-icon {
    width: 24px;
    margin-right: 8px;
  }
`;

const DropdownItem = styled(Item)`
  background: ${(props) => props.bg};
  border: 1px solid ${(props) => props.border};
  border-radius: 16px;
  align-items: flex-start;
  padding: 1rem 0.9rem;
  position: absolute;
  top: 3rem;
  right: 0rem;
  z-index: 10;
  color: #657795;

  @media (max-width: 992px) {
    right: 0.9rem;
    top: 3.5rem;
  }
`;

export default LanguageSwitcher;
