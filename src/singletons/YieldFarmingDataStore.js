// React + Web3 Essentials
import { ethers } from "ethers";

// Internal Configs
import { addresses, appConfig } from "config";

// Constants
const ONE_PUSH = ethers.BigNumber.from(1).mul(
  ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18))
);
const GENESIS_EPOCH_AMOUNT_PUSH = 30000
const GENESIS_EPOCH_AMOUNT_LP = 74400

const bn = function(number, defaultValue = null) { if (number == null) { if (defaultValue == null) { return null } number = defaultValue } return ethers.BigNumber.from(number) }

const tokenToBn = (token) => {
  return token.mul(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18)))
}

const tokenBNtoNumber = (tokenBn) => {
  return tokenBn.div(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(10))).toNumber() / 100000000
}

const bnToInt = function (bnAmount) { return parseInt(bnAmount.div(bn(10).pow(18))) }

export default class YieldFarmingDataStore {
  static instance =
    YieldFarmingDataStore.instance || new YieldFarmingDataStore();

  state = {
    account: null,
    signer: null,
    staking: null,
    yieldFarmingPUSH: null,
    yieldFarmingLP: null,
    rewardForCurrentEpochPush: null,
    rewardForCurrentEpochLP: null,

    genesisEpochAmountPUSH: GENESIS_EPOCH_AMOUNT_PUSH,
    deprecationPerEpochPUSH: 100,
    genesisEpochAmountLP: GENESIS_EPOCH_AMOUNT_LP,
    deprecationPerEpochLP: 900,
    
    uniswapV2Router02:null,
  };

  // init
  init = (account, pushToken, staking, yieldFarmingPUSH, yieldFarmingLP, uniswapV2Router02) => {
    // set account
    this.state.account = account;
    this.state.pushToken = pushToken;
    this.state.staking = staking;
    this.state.yieldFarmingPUSH = yieldFarmingPUSH;
    this.state.yieldFarmingLP = yieldFarmingLP;
    this.state.uniswapV2Router02 = uniswapV2Router02;

  };

  // 1. Listen for Subscribe Async
  getPoolStats = () => {
    
    return new Promise(async (resolve, reject) => {
      const yieldFarmingPUSH = this.state.yieldFarmingPUSH;
      const yieldFarmingLP = this.state.yieldFarmingLP;

      const currentEpochPUSH = await yieldFarmingPUSH.getCurrentEpoch();
      // const pushPriceAmounts = await this.state.uniswapV2Router02.getAmountsOut(ONE_PUSH.toString(), [addresses.pushToken, addresses.WETHAddress, addresses.USDTAddress]);
      // const pushPrice = pushPriceAmounts[pushPriceAmounts.length -1].div(1000000).toNumber();

      const pushPriceAmounts = await this.state.uniswapV2Router02.getAmountsOut(ONE_PUSH.toString(), [
        addresses.pushToken, 
        addresses.WETHAddress, 
        addresses.USDTAddress
      ]);

      let pushPrice;
      // const pushPrice = pushPriceAmounts[pushPriceAmounts.length -1].toNumber()/1000000;

      if (appConfig.coreContractChain === 42 || appConfig.coreContractChain === 5) {
        pushPrice = pushPriceAmounts[pushPriceAmounts.length - 1].div(1000000).toNumber();
      } else {
        pushPrice = pushPriceAmounts[pushPriceAmounts.length - 1].toNumber() / 1000000;
      }

      console.log('Push PRice', pushPrice);

      const pushAmountReserve = tokenBNtoNumber(await this.state.pushToken.balanceOf(addresses.uniV2LPToken))
      const wethAmountReserve = tokenBNtoNumber(await this.state.pushToken.attach(addresses.WETHAddress).balanceOf(addresses.uniV2LPToken)) // Using pushToken instance for WETH instance

      const ethPriceAmounts =  await this.state.uniswapV2Router02.getAmountsOut(ONE_PUSH.toString(), [addresses.WETHAddress, addresses.USDTAddress]);
      // const ethPrice = ethPriceAmounts[ethPriceAmounts.length -1].toNumber()/1000000;
      let ethPrice;
      if (appConfig.coreContractChain === 42 || appConfig.coreContractChain === 5) {
        ethPrice = tokenBNtoNumber(ethPriceAmounts[ethPriceAmounts.length - 1]);
      } else {
        ethPrice = ethPriceAmounts[ethPriceAmounts.length -1].toNumber()/1000000;
      }

      console.log('Eth Price', ethPrice);

      const uniTotalSupply = tokenBNtoNumber(await this.state.pushToken.attach(addresses.uniV2LPToken).totalSupply()) // Using pushToken instance for Uni-V2 instance
      const uniLpPrice = ((pushAmountReserve * pushPrice) + (wethAmountReserve * ethPrice)) / uniTotalSupply
      const lpToPushRatio = uniLpPrice / pushPrice

      const pushNextPoolSize = tokenBNtoNumber(await yieldFarmingPUSH.getPoolSize(currentEpochPUSH.add(1)));
      const lpNextPoolSize = tokenBNtoNumber(await yieldFarmingLP.getPoolSize(currentEpochPUSH.add(1)));

      const totalValueLocked = (pushNextPoolSize * pushPrice) + (lpNextPoolSize * uniLpPrice)

      const epochDuration = await yieldFarmingPUSH.epochDuration();

      const epochStart = await yieldFarmingPUSH.epochStart();

      const start = epochStart.add(currentEpochPUSH.sub(1).mul(epochDuration));
      const epochEndTimestamp = start.add(epochDuration);

      const pushTotalDistributedAmount = await yieldFarmingPUSH.TOTAL_DISTRIBUTED_AMOUNT();
      const lpTotalDistributedAmount = await yieldFarmingLP.TOTAL_DISTRIBUTED_AMOUNT();

      const totalDistributedAmount = pushTotalDistributedAmount.add(
        lpTotalDistributedAmount
      );

      const pushRewardsDistributed = await this.getPushRewardsDistributed();

      resolve({
        totalValueLocked,
        pushPrice,
        epochEndTimestamp,
        totalDistributedAmount,
        pushRewardsDistributed,
        currentEpoch: currentEpochPUSH,
        lpToPushRatio
      });
    });
  };

  // 1. Listen for Subscribe Async
  getPUSHPoolStats = async () => {
    return new Promise(async (resolve, reject) => {
      const yieldFarmingPUSH = this.state.yieldFarmingPUSH;

      const currentEpochPUSH = await yieldFarmingPUSH.getCurrentEpoch();
      const totalEpochPUSH = (await yieldFarmingPUSH.NR_OF_EPOCHS()).toString();

      const genesisEpochAmount = tokenToBn(ethers.BigNumber.from(this.state.genesisEpochAmountPUSH));
      const deprecationPerEpoch = tokenToBn(ethers.BigNumber.from(this.state.deprecationPerEpochPUSH));

      const rewardForCurrentEpoch = this.calcTotalAmountPerEpoch(
        genesisEpochAmount,
        currentEpochPUSH,
        deprecationPerEpoch
      );

      this.state.rewardForCurrentEpochPush = rewardForCurrentEpoch;

      const poolBalance = await yieldFarmingPUSH.getPoolSize(
        currentEpochPUSH.add(1)
      );

      const stakingAPR = this.calcStakingAPR(
        genesisEpochAmount,
        currentEpochPUSH,
        deprecationPerEpoch,
        poolBalance,
      );

      resolve({
        currentEpochPUSH,
        totalEpochPUSH,
        rewardForCurrentEpoch,
        poolBalance,
        stakingAPR
      });
    });
  };

  getlpToPushRatio = async () =>{
    const pushPriceAmounts = await this.state.uniswapV2Router02.getAmountsOut(ONE_PUSH.toString(), [addresses.pushToken, addresses.WETHAddress, addresses.USDTAddress]);
    const pushPrice = pushPriceAmounts[pushPriceAmounts.length -1].toNumber()/1000000;

    const pushAmountReserve = tokenBNtoNumber(await this.state.pushToken.balanceOf(addresses.epnsLPToken))
    const wethAmountReserve = tokenBNtoNumber(await this.state.pushToken.attach(addresses.WETHAddress).balanceOf(addresses.epnsLPToken)) // Using pushToken instance for WETH instance

    const ethPriceAmounts = await this.state.uniswapV2Router02.getAmountsOut(ONE_PUSH.toString(), [addresses.WETHAddress, addresses.USDTAddress]);
    const ethPrice = ethPriceAmounts[ethPriceAmounts.length -1].toNumber()/1000000;

    const uniTotalSupply = tokenBNtoNumber(await this.state.pushToken.attach(addresses.epnsLPToken).totalSupply()) // Using pushToken instance for Uni-V2 instance

    const uniLpPrice = ((pushAmountReserve * pushPrice) + (wethAmountReserve * ethPrice)) / uniTotalSupply
    const lpToPushRatio = uniLpPrice / pushPrice

    return lpToPushRatio;
  }

  getLPPoolStats = async (
    poolStats
  ) => {
    return new Promise(async (resolve, reject) => {
      const yieldFarmingLP = this.state.yieldFarmingLP;
      const currentEpochPUSH = await yieldFarmingLP.getCurrentEpoch();
      const totalEpochPUSH = (await yieldFarmingLP.NR_OF_EPOCHS()).toString();
      const genesisEpochAmount = tokenToBn(ethers.BigNumber.from(this.state.genesisEpochAmountLP));
      const deprecationPerEpoch = tokenToBn(ethers.BigNumber.from(this.state.deprecationPerEpochLP));

      const rewardForCurrentEpoch = this.calcTotalAmountPerEpoch(
        genesisEpochAmount,
        currentEpochPUSH,
        deprecationPerEpoch
      );

      this.state.rewardForCurrentEpochLP = rewardForCurrentEpoch;

      const poolBalance = await yieldFarmingLP.getPoolSize(
        currentEpochPUSH.add(1)
      );

      const stakingAPR = await this.calcLPPoolAPR(
        genesisEpochAmount,
        currentEpochPUSH,
        deprecationPerEpoch,
        poolBalance,
        poolStats
      );

      resolve({
        currentEpochPUSH,
        totalEpochPUSH,
        rewardForCurrentEpoch,
        poolBalance,
        stakingAPR
      });
    });
  };

  // 1. Listen for Subscribe Async
  getUserData = async (contract) => {
    return new Promise(async (resolve, reject) => {
      if (this.state.account) {
        const currentEpochPUSH = await contract.getCurrentEpoch().then(res=>ethers.BigNumber.from(Math.min(res,100)));


        const potentialUserReward = (await this.calculateUserEpochReward(currentEpochPUSH, contract)).toFixed(2);

        const epochStakeNext = await contract.getEpochStake(
          this.state.account,
          currentEpochPUSH.add(1)
        );

        // TODO: these two loops can be done in one loop
        let totalAccumulatedReward = 0
        for(var i=0; i<=currentEpochPUSH.sub(1).toNumber(); i++){
          const epochReward = await this.calculateUserEpochReward(i, contract)
          totalAccumulatedReward = totalAccumulatedReward + epochReward
        }
        totalAccumulatedReward = totalAccumulatedReward.toFixed(2)

        const lastEpochIdHarvested = (await contract.lastEpochIdHarvested(this.state.account)).toNumber()
        
        let totalAvailableReward = 0

        for(var i = lastEpochIdHarvested + 1; i<=currentEpochPUSH.sub(1).toNumber(); i++){
          const epochReward = await this.calculateUserEpochReward(i, contract)
          totalAvailableReward = totalAvailableReward + epochReward
        }

        totalAvailableReward = totalAvailableReward.toFixed(2)

        resolve({
          potentialUserReward,
          epochStakeNext,
          totalAccumulatedReward,
          totalAvailableReward
        });
      }
    });
  };

  getPushRewardsDistributed = async () => {
    const yieldFarmingPUSH = this.state.yieldFarmingPUSH;
    const yieldFarmingLP = this.state.yieldFarmingLP;

    const currentEpochPUSH = await yieldFarmingPUSH.getCurrentEpoch();
    const genesisEpochAmountPUSH = tokenToBn(ethers.BigNumber.from(this.state.genesisEpochAmountPUSH))
    const deprecationPerEpochPUSH = tokenToBn(ethers.BigNumber.from(this.state.deprecationPerEpochPUSH))
    
    const currentEpochLP = await yieldFarmingLP.getCurrentEpoch().then(
      res=>ethers.BigNumber.from(Math.min(res.toNumber(),100)
    ));
    
    const genesisEpochAmountLP = tokenToBn(ethers.BigNumber.from(this.state.genesisEpochAmountLP))
    const deprecationPerEpochLP = tokenToBn(ethers.BigNumber.from(this.state.deprecationPerEpochLP))

    let pushPoolRewardsDistributed = ethers.BigNumber.from(0);
    let lpPoolRewardsDistributed = ethers.BigNumber.from(0);

    for(var i=0; i<currentEpochLP.toNumber(); i++){
      const rewardForCurrentEpochLP = this.calcTotalAmountPerEpoch(
        genesisEpochAmountLP,
        ethers.BigNumber.from(i),
        deprecationPerEpochLP
      );

      lpPoolRewardsDistributed = lpPoolRewardsDistributed.add(rewardForCurrentEpochLP);

      const rewardForCurrentEpochPUSH = this.calcTotalAmountPerEpoch(
        genesisEpochAmountPUSH,
        ethers.BigNumber.from(i),
        deprecationPerEpochPUSH
      );

      pushPoolRewardsDistributed = pushPoolRewardsDistributed.add(rewardForCurrentEpochPUSH);
    }

    return pushPoolRewardsDistributed.add(lpPoolRewardsDistributed)
  }

  calcTotalAmountPerEpoch = (
    genesisEpochAmount,
    epochId,
    deprecationPerEpoch,
  ) => {
    // if (epochId > maxEpochs){
    //   return genesisEpochAmount.mul(0)
    // }
    return genesisEpochAmount.sub(epochId.mul(deprecationPerEpoch));
  };

  calcAnnualEpochReward = (
    genesisEpochAmount,
    epochId,
    deprecationPerEpoch
  ) => {
    // get current epoch reward
    const currentEpochReward = this.calcTotalAmountPerEpoch(genesisEpochAmount, epochId, deprecationPerEpoch)

    const weeks = 52
    const depreciate = deprecationPerEpoch.mul(weeks * (weeks - 1)).div(2)

    const annualEpochReward = (currentEpochReward.mul(weeks)).sub(depreciate)


    return annualEpochReward
  }

  calcStakingAPR = (
    genesisEpochAmount,
    epochId,
    deprecationPerEpoch,
    totalStaked
  ) => {
    // get annual rewards
    const annualRewards = this.calcAnnualEpochReward(genesisEpochAmount, epochId, deprecationPerEpoch)

    let apr;
    if(appConfig.coreContractChain === 42 || appConfig.coreContractChain === 5)
    // apr = annualRewards.mul(1000000).div(Math.max(totalStaked, 1));
    apr = (tokenBNtoNumber(annualRewards) * 1000000) / Math.max(tokenBNtoNumber(totalStaked), 1);
    else
    apr = annualRewards.mul(1000000).div(totalStaked);
    const aprFormatted = (parseInt(apr.toString())/10000).toFixed(2)

    return aprFormatted
  }


  calcLPPoolAPR = async (
    genesisEpochAmount,
    epochId,
    deprecationPerEpoch,
    totalStaked,
    poolStats
  ) => {
    // get annual rewards
    const annualRewards = this.calcAnnualEpochReward(genesisEpochAmount, epochId, deprecationPerEpoch)

    let apr;
    if(appConfig.coreContractChain === 42 || appConfig.coreContractChain === 5)
    // apr = annualRewards.mul(1000000).div(Math.max(totalStaked, 1));
    apr = (tokenBNtoNumber(annualRewards) * 1000000) / Math.max(tokenBNtoNumber(totalStaked), 1);
    else
    apr = annualRewards.mul(1000000).div(totalStaked);

    const aprFormatted = (parseInt(apr.toString())/(10000 * poolStats.lpToPushRatio)).toFixed(2)

    return aprFormatted
   
  }

  calculateUserEpochReward = async (
    epochId,
    contract
  ) => {
      const epochStake = tokenBNtoNumber(await contract.getEpochStake(
        this.state.account,
        epochId
      ));
      const poolSize = tokenBNtoNumber(await contract.getPoolSize(epochId));


      let potentialUserReward = 0;
      if (poolSize > 0) {
        if (contract.address == addresses.depYieldFarmLP) {
          const genesisEpochAmount = this.state.genesisEpochAmountLP;
          const deprecationPerEpoch = this.state.deprecationPerEpochLP;
          const rewardForCurrentEpoch =  genesisEpochAmount - deprecationPerEpoch*epochId
          potentialUserReward = epochStake / poolSize * rewardForCurrentEpoch
        }
        else {
          const rewardForCurrentEpoch = tokenBNtoNumber(this.state.rewardForCurrentEpochPush)
          potentialUserReward = epochStake / poolSize * rewardForCurrentEpoch
        }
      }
      return potentialUserReward
  }
}
