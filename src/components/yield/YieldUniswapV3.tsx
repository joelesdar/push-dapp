// React + Web3 Essentials
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';


// External Packages
import styled, { css, useTheme } from 'styled-components';
import { MdCheckCircle, MdError } from 'react-icons/md';

// Internal Compoonents
import useToast from 'hooks/useToast';
import useModalBlur, { MODAL_POSITION } from 'hooks/useModalBlur';
import InfoLogo from "../../assets/inforWithoutBG.svg";
import { B, Button } from 'primaries/SharedStyling';
import LoaderSpinner, { LOADER_TYPE } from 'components/reusables/loaders/LoaderSpinner';
import { formatTokens, numberWithCommas } from 'helpers/StakingHelper';
import ErrorLogo from "../../assets/errorLogo.svg"
import StakingToolTip from './StakingToolTip';
import StakingModalComponent from './StakingModalComponent';
import { ButtonV2, H2V2, ImageV2, ItemHV2, ItemVV2, SectionV2, Skeleton, SkeletonLine, SpanV2 } from 'components/reusables/SharedStylingV2';

// Internal Configs
import { abis, addresses } from 'config';


const bn = function (number, defaultValue = null) { if (number == null) { if (defaultValue == null) { return null } number = defaultValue } return ethers.BigNumber.from(number) }

const YieldUniswapV3 = ({
    lpPoolStats,
    userDataLP,
    getLpPoolStats,
    getUserDataLP
}) => {
    const { active, error, account, library, chainId } = useWeb3React();

    const [txInProgressWithdraw, setTxInProgressWithdraw] = React.useState(false);
    const [txInProgressClaimRewards, setTxInProgressClaimRewards] = React.useState(false);

    const [withdrawErrorMessage, setWithdrawErrorMessage] = useState(null);
    const [unstakeErrorMessage, setUnstakeErrorMessage] = useState(null);

    const uniswapV2Toast = useToast();
    const theme = useTheme();

    const withdrawAmountTokenFarmAutomatic = async () => {
        if (txInProgressWithdraw) {
            return;
        }

        setTxInProgressWithdraw(true);
        const withdrawAmount = formatTokens(userDataLP.epochStakeNext);

        console.log("Withdraw amount: ", withdrawAmount);

        if (withdrawAmount == 0) {
            setUnstakeErrorMessage("Nothing to unstake. You need to stake first");
            setTxInProgressWithdraw(false);
            return;
        }

        var signer = library.getSigner(account);
        let staking = new ethers.Contract(addresses.stakingV2, abis.stakingV2, signer);

        const amounttowithdraw = await staking.balanceOf(
            account,
            addresses.uniV2LPToken
        )

        const tx = staking.withdraw(
            addresses.uniV2LPToken,
            ethers.BigNumber.from(withdrawAmount).mul(
                ethers.BigNumber.from(10).pow(18)
            )
        );

        tx.then(async (tx) => {
            uniswapV2Toast.showLoaderToast({ loaderMessage: 'Waiting for Confirmation...' });

            try {
                await library.waitForTransaction(tx.hash);
                uniswapV2Toast.showMessageToast({
                    toastTitle: 'Success',
                    toastMessage: 'Transaction Completed!',
                    toastType: 'SUCCESS',
                    getToastIcon: (size) => (
                        <MdCheckCircle
                            size={size}
                            color="green"
                        />
                    ),
                });

                setTxInProgressWithdraw(false);

                getLpPoolStats();
                getUserDataLP();
            } catch (e) {
                console.log("Error", e);
                uniswapV2Toast.showMessageToast({
                    toastTitle: 'Error',
                    toastMessage: `Transaction Failed! (" +${e.name}+ ")`,
                    toastType: 'ERROR',
                    getToastIcon: (size) => <MdError size={size} color="red" />,
                });

                setTxInProgressWithdraw(false);
            }
        }).catch((err) => {
            uniswapV2Toast.showMessageToast({
                toastTitle: 'Error',
                toastMessage: `Transaction Cancelled!`,
                toastType: 'ERROR',
                getToastIcon: (size) => <MdError size={size} color="red" />,
            });

            setTxInProgressWithdraw(false);
        });
    };

    const massClaimRewardsTokensAll = async () => {
        if (txInProgressClaimRewards) {
            return;
        }

        if (userDataLP?.totalAvailableReward == 0) {
            setWithdrawErrorMessage("No Rewards to Claim!")
            return;
        }

        if (!lpPoolStats.currentEpochPUSH || lpPoolStats.currentEpochPUSH == 1) {
            uniswapV2Toast.showMessageToast({
                toastTitle: 'Error',
                toastMessage: `Harvest unlocks from Epoch 2!)`,
                toastType: 'ERROR',
                getToastIcon: (size) => <MdError size={size} color="red" />,
            });

            return;
        }
        setTxInProgressClaimRewards(true);

        var signer = library.getSigner(account);
        let yieldFarmingLP = new ethers.Contract(
            addresses.yieldFarmLP,
            abis.yieldFarming,
            signer
        );
        const tx = yieldFarmingLP.massHarvest();

        tx.then(async (tx) => {
            uniswapV2Toast.showLoaderToast({ loaderMessage: 'Waiting for Confirmation...' });

            try {
                await library.waitForTransaction(tx.hash);

                uniswapV2Toast.showMessageToast({
                    toastTitle: 'Success',
                    toastMessage: 'Transaction Completed!',
                    toastType: 'SUCCESS',
                    getToastIcon: (size) => (
                        <MdCheckCircle
                            size={size}
                            color="green"
                        />
                    ),
                });

                getUserDataLP();
                setTxInProgressClaimRewards(false);
            } catch (e) {
                uniswapV2Toast.showMessageToast({
                    toastTitle: 'Error',
                    toastMessage: `Transaction Failed! (" +${e.name}+ ")`,
                    toastType: 'ERROR',
                    getToastIcon: (size) => <MdError size={size} color="red" />,
                });

                setTxInProgressClaimRewards(false);
            }
        }).catch((err) => {
            uniswapV2Toast.showMessageToast({
                toastTitle: 'Error',
                toastMessage: `Transaction Cancelled!`,
                toastType: 'ERROR',
                getToastIcon: (size) => <MdError size={size} color="red" />,
            });

            setTxInProgressClaimRewards(false);
        });
    };

    React.useEffect(() => {
        setWithdrawErrorMessage(null);
        setUnstakeErrorMessage(null);
    }, [account])

    const handleStakingModal = () => {
        if (lpPoolStats?.currentEpochLP.toNumber() + 1 <= lpPoolStats?.totalEpochLP.toNumber()) {
            showStakingModal();
        } else {
            uniswapV2Toast.showMessageToast({
                toastTitle: 'Error',
                toastMessage: `Epochs have ended!`,
                toastType: 'ERROR',
                getToastIcon: (size) => <MdError size={size} color="red" />,
            });
        }
    }

    const {
        isModalOpen: isStakingModalOpen,
        showModal: showStakingModal,
        ModalComponent: StakingComponent,
    } = useModalBlur();

    const stakingModalToast = useToast();

    return (
        <Container>

            <StakingComponent
                InnerComponent={StakingModalComponent}
                InnerComponentProps={{
                    title: 'Uni-V2',
                    getUserData: getUserDataLP,
                    getPoolStats: getLpPoolStats,
                    setUnstakeErrorMessage: setUnstakeErrorMessage,
                    setWithdrawErrorMessage: setWithdrawErrorMessage,
                }}
                toastObject={stakingModalToast}
                modalPosition={MODAL_POSITION.ON_PARENT}
            />

            {/* Top Section */}
            <ItemVV2 margin="0px 0px 20px 0px">
                {lpPoolStats ? (
                    <>
                        <Heading >Uniswap V2 LP Staking Pool</Heading>
                        <SecondaryText>
                            Current APR <SpanV2 color="#D53A94" fontWeight="600">{numberWithCommas(lpPoolStats?.stakingAPR)}%</SpanV2>
                        </SecondaryText>
                    </>
                ) : (
                    <SkeletonContainer
                        padding='5px 15px 0 15px'
                    >
                        <SkeletonLine height='12px' width='234px' margin='0 0 10px 0'></SkeletonLine>
                        <SkeletonLine height='12px' width='112px'></SkeletonLine>
                    </SkeletonContainer>
                )}
            </ItemVV2>

            {/* Body Section */}
            <ItemVV2
                flex='5'
            >
                {/* Reward Section */}
                <RewardContainer
                    border={`1px solid ${theme.stakingBorder}`}
                    borderRadius="16px"
                >
                    <ItemVV2 margin="0px 18px 0px 0px" padding="10px">
                        {lpPoolStats ? (
                            <>
                                <SecondaryText>Current Reward</SecondaryText>
                                <H2V2
                                    fontSize="24px"
                                    fontWeight="600"
                                    color="#D53A94"
                                    letterSpacing="-0.03em"
                                >
                                    {numberWithCommas(formatTokens(lpPoolStats?.rewardForCurrentEpoch))} PUSH
                                </H2V2>
                            </>
                        ) : (
                            <SkeletonContainer
                                padding='5px 15px 0 15px'
                            >
                                <SkeletonLine height='12px' width='135px' margin='0 0 8px 0'></SkeletonLine>
                                <SkeletonLine height='12px' width='100px'></SkeletonLine>
                            </SkeletonContainer>
                        )}
                    </ItemVV2>

                    <Line width="10px" height="100%"></Line>

                    <ItemVV2 margin="0px 0px 0px 18px" padding="10px">
                        {lpPoolStats ? (
                            <>
                                <SecondaryText>Total Staked</SecondaryText>

                                <StakedAmount
                                    fontSize="24px"
                                    fontWeight="600"
                                    letterSpacing="-0.03em"
                                >
                                    {numberWithCommas(formatTokens(lpPoolStats?.poolBalance))} UNI-V2
                                </StakedAmount>
                            </>
                        ) : (
                            <SkeletonContainer
                                padding='5px 15px 0 15px'
                            >
                                <SkeletonLine height='12px' width='135px' margin='0 0 8px 0'></SkeletonLine>
                                <SkeletonLine height='12px' width='100px'></SkeletonLine>
                            </SkeletonContainer>
                        )}
                    </ItemVV2>

                </RewardContainer>

                {/* Epoch Text */}
                <ItemHV2
                    alignSelf="end"
                    margin="12px 13px 24px 0px"
                    color="#575D73"
                    letterSpacing="-0.03em"
                >
                    {lpPoolStats ? (
                        <>
                            <EpochNo>Current Epoch</EpochNo>
                            <EpochNo>
                                {Math.min(lpPoolStats?.currentEpochLP, lpPoolStats?.totalEpochLP).toString()}
                                /
                                {lpPoolStats?.totalEpochLP.toString()}
                            </EpochNo>
                        </>
                    ) : (
                        <SkeletonContainer
                            padding='5px 0px 0 15px'
                        >
                            <SkeletonLine height='12px' width='124px' ></SkeletonLine>
                        </SkeletonContainer>
                    )}
                </ItemHV2>

                {/* Deposit Cash Data */}
                {userDataLP ? (
                    <ItemVV2>
                        <ItemHV2 justifyContent="space-between" margin="0px 13px 12px 13px">
                            <DataTitle>
                                User Deposit
                                <InfoSpan>
                                    <StakingToolTip
                                        ToolTipTitle={"User Deposited"}
                                        ToolTipBody={"Amount of PUSH Token User Staked"}
                                    >
                                        <ImageV2 src={InfoLogo} alt="Info-Logo" width="16px" style={{ cursor: 'pointer' }} />
                                    </StakingToolTip>
                                </InfoSpan>
                            </DataTitle>
                            <DataValue>{formatTokens(userDataLP?.epochStakeNext)} UNI-V2</DataValue>
                        </ItemHV2>
                        <ItemHV2 justifyContent="space-between" margin="0px 13px 12px 13px">
                            <DataTitle>
                                Rewards Claimed
                                <InfoSpan>
                                    <StakingToolTip
                                        ToolTipTitle={"Rewards Claimed"}
                                        ToolTipBody={"Amount of Push Claimed by User"}
                                    >
                                        <ImageV2 src={InfoLogo} alt="Info-Logo" width="16px" style={{ cursor: 'pointer' }} />
                                    </StakingToolTip>
                                </InfoSpan>
                            </DataTitle>
                            <DataValue> {numberWithCommas((userDataLP?.totalAccumulatedReward - userDataLP?.totalAvailableReward).toFixed(2))} PUSH</DataValue>
                        </ItemHV2>
                        <ItemHV2 justifyContent="space-between" margin="0px 13px 12px 13px">
                            <DataTitle>
                                Current Epoch Reward
                                <InfoSpan>
                                    <StakingToolTip
                                        ToolTipTitle={"Current Epoch Reward"}
                                        ToolTipBody={"Amount of Push Token Claimable in this EPOCH"}
                                    >
                                        <ImageV2 src={InfoLogo} alt="Info-Logo" width="16px" style={{ cursor: 'pointer' }} />
                                    </StakingToolTip>
                                </InfoSpan>
                            </DataTitle>
                            <DataValue> {numberWithCommas(userDataLP?.potentialUserReward)} PUSH</DataValue>
                        </ItemHV2>
                        <ItemHV2 justifyContent="space-between" margin="0px 13px 12px 13px">
                            <DataTitle>
                                Available for Claiming
                                <InfoSpan>
                                    <StakingToolTip
                                        ToolTipTitle={"Available for Claiming"}
                                        ToolTipBody={"Amount of Push Token Available to claim"}
                                    >
                                        <ImageV2 src={InfoLogo} alt="Info-Logo" width="16px" style={{ cursor: 'pointer' }} />
                                    </StakingToolTip>
                                </InfoSpan>
                            </DataTitle>
                            <DataValue> {numberWithCommas(userDataLP?.totalAvailableReward)} PUSH</DataValue>
                        </ItemHV2>
                    </ItemVV2>
                ) : (
                    <Skeleton
                        padding='0 15px 15px 15px'
                        width='100%'
                        maxWidth=' -webkit-fill-available'
                        borderRadius='5px'
                    >
                        <ItemHV2 justifyContent='space-between' margin='0 0 23px 0'>
                            <SkeletonLine height='12px' width='164px' ></SkeletonLine>
                            <SkeletonLine height='12px' width='72px'></SkeletonLine>
                        </ItemHV2>
                        <ItemHV2 justifyContent='space-between' margin='0 0 23px 0'>
                            <SkeletonLine height='12px' width='164px' ></SkeletonLine>
                            <SkeletonLine height='12px' width='72px'></SkeletonLine>
                        </ItemHV2>
                        <ItemHV2 justifyContent='space-between' margin='0 0 23px 0'>
                            <SkeletonLine height='12px' width='164px' ></SkeletonLine>
                            <SkeletonLine height='12px' width='72px'></SkeletonLine>
                        </ItemHV2>
                        <ItemHV2 justifyContent='space-between'>
                            <SkeletonLine height='12px' width='164px' ></SkeletonLine>
                            <SkeletonLine height='12px' width='72px'></SkeletonLine>
                        </ItemHV2>

                    </Skeleton>
                )}

            </ItemVV2>

            {/* Bottom Section */}
            <ItemVV2 padding=" 0px 14px" margin="24px 0px 24px 0px">
                {userDataLP ? (
                    <>
                        <ItemHV2>
                            <FilledButton
                                onClick={() => {
                                    handleStakingModal();
                                }}>Stake UNI-V2 LP Tokens</FilledButton>
                        </ItemHV2>
                        <ButtonsContainer>

                            {formatTokens(userDataLP?.epochStakeNext) === "0" ?
                                <StakingToolTip
                                    error={true}
                                    ToolTipTitle={"Nothing to unstake! Stake First."}
                                    ToolTipWidth={"16rem"}
                                    margin={'0 10px 0 0'}
                                    bottom={'-30px'}
                                >
                                    <EmptyButton
                                        border="none"
                                        background={theme.disableButtonBg}
                                        cursor='default'
                                        color={theme.disabledButtonText}
                                    >
                                        {txInProgressWithdraw ?
                                            (<LoaderSpinner type={LOADER_TYPE.SEAMLESS} spinnerSize={26} spinnerColor="#D53A94" />) :
                                            "Unstake UNI-V2"
                                        }
                                    </EmptyButton>
                                </StakingToolTip>

                                :

                                <EmptyButton
                                    border={`1px solid ${theme.activeButtonText}`}
                                    background={'transparent'}
                                    color={theme.activeButtonText}
                                    cursor='pointer'
                                    onClick={withdrawAmountTokenFarmAutomatic}
                                    style={{ margin: "0px 10px 0px 0px" }}
                                >
                                    {txInProgressWithdraw ?
                                        (<LoaderSpinner type={LOADER_TYPE.SEAMLESS} spinnerSize={26}  spinnerColor={theme.activeButtonText} title='Unstaking' titleColor={theme.activeButtonText}/>) :
                                        "Unstake UNI-V2"
                                    }
                                </EmptyButton>

                            }

                            {userDataLP?.totalAvailableReward === "0.00" ?
                                <StakingToolTip
                                    bottom={'-30px'}
                                    left={"40px"}
                                    ToolTipTitle={"No Rewards to Claim!"}
                                    error={true}
                                    ToolTipWidth={"10rem"}
                                >
                                    <EmptyButton
                                        border="none"
                                        cursor='default'
                                        background={theme.disableButtonBg}
                                        color={theme.disabledButtonText}
                                    >
                                        {txInProgressClaimRewards ?
                                            (<LoaderSpinner type={LOADER_TYPE.SEAMLESS} spinnerSize={26} spinnerColor="#FFFFF" />) :
                                            "Claim Rewards"
                                        }
                                    </EmptyButton>
                                </StakingToolTip>
                                :
                                <EmptyButton
                                    border={`1px solid ${theme.activeButtonText}`}
                                    background={'transparent'}
                                    color={theme.activeButtonText}
                                    cursor='pointer'
                                    onClick={() => massClaimRewardsTokensAll()}
                                >
                                    {txInProgressClaimRewards ?
                                        (<LoaderSpinner type={LOADER_TYPE.SEAMLESS} spinnerSize={26} spinnerColor={theme.activeButtonText} title='Claiming' titleColor={theme.activeButtonText} />) :
                                        "Claim Rewards"
                                    }
                                </EmptyButton>
                            }

                        </ButtonsContainer>

                    </>
                ) : (

                    <SkeletonContainer width='100%'>
                        <SkeletonLine height='49px' width='100%' margin='0 0 8px 0'></SkeletonLine>
                        <SkeletonLine height='49px' width='100%'></SkeletonLine>
                    </SkeletonContainer>
                )}

            </ItemVV2>

        </Container >

    );
};

export default YieldUniswapV3;

const Container = styled(SectionV2)`
    border: 1px solid  ${(props) => props.theme.stakingBorder};
    border-radius: 24px;
    padding:20px;
    margin:10px 10px 10px 0;
    font-family: 'Strawford';
    
    font-style: normal;
    font-weight: 500;
    min-height: 587px;
    color: ${(props) => props.theme.stakingPrimaryText};

`;

const Heading = styled(H2V2)`
    font-size: 24px;
    line-height: 141%;
    letter-spacing: -0.03em;
    color: ${(props) => props.theme.stakingPrimaryText};

`
const SecondaryText = styled.div`
    margin:0px;
    font-size: 18px;
    line-height: 141%;
    letter-spacing: -0.03em;
    // color: #333333;
`

const RewardContainer = styled(ItemHV2)`
    min-height:110px;
`

const Line = styled.div`
    width: 1px;
    height: 100%;
    background:${(props) => props.theme.stakingBorder};
`
const DataTitle = styled.div`
    font-size: 18px;
    line-height: 141%;
    letter-spacing: -0.03em;
    // color: rgba(87, 93, 115, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    color: ${(props) => props.theme.stakingUserDetails};

`

const StakedAmount = styled(H2V2)`
    color: ${(props) => props.theme.stakingSecondaryText};
`

const EpochNo = styled(B)`
    font-weight: 600;
    text-align: right;
    letter-spacing: -0.03em;
    font-size: 16px;
    line-height: 141%;
    margin-right:5px;
    color: ${(props) => props.theme.stakingUserDetails};
`

const InfoSpan = styled(SpanV2)`
    margin:0px 0px 0px 6px;
    cursor:pointer;
`

const DataValue = styled(H2V2)`
    font-size: 18px;
    line-height: 141%;
    letter-spacing: -0.03em;
    color: ${(props) => props.theme.stakingPrimaryText};
`

const ButtonsContainer = styled.div`
    display: flex;
    width: 100%;
    margin:15px 0px 0px 0px;
`

const FilledButton = styled(ButtonV2)`
    width:100%;
    background: #D53A94;
    border: 1px solid #D53A94;
    border-radius: 8px;
    padding: 12px;
    font-size: 16px;
    line-height: 141%;
    letter-spacing: -0.03em;
    color: #FFFFFF;
    cursor:pointer;
    & > div{
        display:block;
    }
    
`;

const EmptyButton = styled(ButtonV2)`
    font-size: 16px;
    line-height: 19px;
    flex-direction:row;
    flex:1;
    // width: 145px;
    height: 49px;
    padding:12px;
    border-radius: 8px;
    & > div{
        display:block;
    }
    &:after{
        background:transparent;
    }

    &:hover{
        opacity:1;
    }
`

const Toaster = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 0px 10px;
`;

const ToasterMsg = styled.div`
  margin: 0px 10px;
`;


const SkeletonContainer = styled(Skeleton)`
    // width:150px;
    max-width:-webkit-fill-available;
    border-radius: 5px;
    gap:5px;
`

const UserSkeletonLine = styled(SkeletonLine)`
    height: 25px;
    width:100%;
    border-radius: 2px;
`

const RewardSkeletonLine = styled(SkeletonLine)`
    height: 20px;
    width:100%;
    border-radius: 2px;
`

