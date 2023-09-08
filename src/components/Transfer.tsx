import { BiconomySmartAccount } from "@biconomy/account";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { USDC_CONTRACT_ADDRESS, ERC20ABI } from "@/constants";
import { IHybridPaymaster, PaymasterMode, SponsorUserOperationDto } from "@biconomy/paymaster";

export default function Transfer({
    smartAccount,
}: {
    smartAccount: BiconomySmartAccount;
}) {

    const [smartContractAddress, setSmartContractAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [amount, setAmount] = useState(0);
    const [recipient, setRecipient] = useState("");

    async function getSmartContractAddress() {
        const smartContractAddress = await smartAccount.getSmartAccountAddress();
        setSmartContractAddress(smartContractAddress);
    }

    async function transfer(){
        try{
            //Initiaite the loading state
            setIsLoading(true);
    
            //Create an ethers contract instance for USDC
            const readProvider = smartAccount.provider;
            const tokenContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20ABI, readProvider);
    
            //Fetch the amount of decimals in the ERC20 contract
            const decimals = await tokenContract.decimals();
            //Convert the user input amount to the proper denomination unit based on the token decimals
            const amountInLowestUnit = ethers.utils.parseUnits(
                amount.toString(),
                decimals
            );
    
            //Create the call data for our user operation
            const populatedTransferTxn = 
                await tokenContract.populateTransaction.transfer(
                    recipient,
                    amountInLowestUnit
                );
            const calldata = populatedTransferTxn.data;
    
            //Build the user oepration
            const userOp = await smartAccount.buildUserOp([
                {
                    to: USDC_CONTRACT_ADDRESS,
                    data: calldata,
                },
            ]);
    
            //Get the paymaster fee quote from Biconomy
            const biconomyPaymaster = smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
            const feeQuoteResponse = await biconomyPaymaster.getPaymasterFeeQuotesOrData(userOp, {
                mode: PaymasterMode.ERC20,
                tokenList: [],
                preferredToken: USDC_CONTRACT_ADDRESS,
            });
            const feeQuote = feeQuoteResponse.feeQuotes;
            if (!feeQuote) throw new Error("Could not fetch fee quote in USDC");
    
            const spender = feeQuoteResponse.tokenPaymasterAddress || "";
            const selectedFeeQuote = feeQuote[0];
    
            //Build the paymaster userOp
            let finalUserOp = await smartAccount.buildTokenPaymasterUserOp(userOp, {
                feeQuote: selectedFeeQuote,
                spender: spender,
                //Updated from 'true' -> 'false' 9/7/23
                maxApproval: false,
            });
    
            //Get the call data for the paymaster
            const paymasterServiceData = {
                mode: PaymasterMode.ERC20,
                feeTokenAddress: USDC_CONTRACT_ADDRESS,
                //Added the line below 9/7/23
                calculateGasLimits: true,
            };
            const paymasterAndDataResponse = await biconomyPaymaster.getPaymasterAndData(finalUserOp, paymasterServiceData);
            finalUserOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;

            if (
                paymasterAndDataResponse.callGasLimit &&
                paymasterAndDataResponse.verificationGasLimit &&
                paymasterAndDataResponse.preVerificationGas
            ) {
                //Returned gas limits must be replaced in your op as you update paymasterAndData
                //Becuase these are the limits paymaster service signed on to generate paymasterAndData
                //If you recieve AA34 error check here...

                finalUserOp.callGasLimit = paymasterAndDataResponse.callGasLimit;
                finalUserOp.verificationGasLimit = 
                    paymasterAndDataResponse.verificationGasLimit;
                finalUserOp.preVerificationGas =
                    paymasterAndDataResponse.preVerificationGas;
            }
    
            //Send the userOperation
            const userOpResponse = await smartAccount.sendUserOp(finalUserOp);
            const receipt = await userOpResponse.wait();
    
            console.log(`Transaction receipt: ${JSON.stringify(receipt, null, 2)}`);
            window.alert("transaction successful");
        } catch (error) {
            console.log(error);
        }

        setIsLoading(false);
    }

    //Get the address of the smart account when the component loads
    useEffect(() => {
        getSmartContractAddress();
    }, []);

    return (
        <div>
            <p className="text-sm">
                {" "}
                Your smart account address is : {smartContractAddress}
            </p>
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <div>
                    <p>Transfer token from your account to another :</p>
                    <div className="mt-5 flex w-auto flex-col gap-2">
                        <input
                            className="rounded-x1 border-2 p-1 text-gray-500"
                            type="text"
                            placeholder="Enter address"
                            onChange={(e) => setRecipient(e.target.value)}
                        />
                        <input
                            className="rounded-x1 border-2 p-1 text-gray-500"
                            type="number"
                            placeholder="Enter amount"
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />
                        <button
                            className="w-32 rounded-lg bg-gradient-to-r from-green-400 to-blue-
                            500 px-4 py-2 font-medium transition-all hover:from-green-500 hover:to-blue-600"
                            onClick={transfer}
                        >
                            Transfer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
