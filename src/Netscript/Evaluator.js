/* Evaluator
 * 	Evaluates the Abstract Syntax Tree for Netscript
 *  generated by the Parser class
 */
// Evaluator should return a Promise, so that any call to evaluate() can just
//wait for that promise to finish before continuing
function evaluate(exp, workerScript) {
	var env = workerScript.env;
    if (exp == null) {
        return new Promise(function(resolve, reject) {
            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Error: NULL expression");
        });
    }
    switch (exp.type) {
		case "num":
		case "str":
		case "bool":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				resolve(exp.value);
			});
			break;
		case "var":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				try {
					resolve(env.get(exp.value));
				} catch (e) {
					throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
				}
			});
			break;
		//Can currently only assign to "var"s
		case "assign":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				if (exp.left.type != "var")
					throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "| Cannot assign to " + JSON.stringify(exp.left));
				
				var p = new Promise(function(resolve, reject) {
					setTimeout(function() { 
						var expRightPromise = evaluate(exp.right, workerScript);
						expRightPromise.then(function(expRight) {
							resolve(expRight);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime)
				});
				
				p.then(function(expRight) {
					try {
						env.set(exp.left.value, expRight);
					} catch (e) {
						throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
					}
					resolve(false); //Return false so this doesnt cause loops/ifs to evaluate
				}, function(e) {
					reject(e);
				});
			});
			
		case "binary":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var pLeft = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var promise = evaluate(exp.left, workerScript);
						promise.then(function(valLeft) {
							resolve(valLeft);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
			
				pLeft.then(function(valLeft) {
					var pRight = new Promise(function(resolve, reject) {
						setTimeout(function() {
							var promise = evaluate(exp.right, workerScript);
							promise.then(function(valRight) {
								resolve([valLeft, valRight]);
							}, function(e) {
								reject(e);
							});
						}, CONSTANTS.CodeInstructionRunTime);
					});
				
					pRight.then(function(args) {
						try {
							resolve(apply_op(exp.operator, args[0], args[1]));
						} catch (e) {
							reject("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
						}
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			});
			break;

		//TODO
		case "if":
            return new Promise(function(resolve, reject) {
                var numConds = exp.cond.length;
                var numThens = exp.then.length;
                if (numConds == 0 || numThens == 0 || numConds != numThens) {
                    reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Number of conds and thens in if structure don't match (or there are none)");
                }
                
                for (var i = 0; i < numConds; i++) {
                    var cond = evaluate(exp.cond[i], workerScript);
                    cond.then(function(condRes) {
                        if (cond) {
                            return evaluate(exp.then[i], workerScript);
                        } 
                    }, function(e) {
                        reject(e);
                    });
                    
                }
                
                //Evaluate else if it exists, snce none of the conditionals
                //were true
                if (exp.else) {
                    return evaluate(exp.else, workerScript);
                } 
            });
            break;
		case "for":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				console.log("for loop encountered in evaluator");
                workerScript.scriptRef.log("Entering for loop");
				var pInit = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var resInit = evaluate(exp.init, workerScript);
						resInit.then(function(foo) {
							resolve(resInit);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});

				pInit.then(function(expInit) {
					var pForLoop = evaluateFor(exp, workerScript);
					pForLoop.then(function(forLoopRes) {
						resolve("forLoopDone");
                        workerScript.scriptRef.log("Exiting for loop");
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			});
			break;
		case "while":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var pEvaluateWhile = evaluateWhile(exp, workerScript);
				pEvaluateWhile.then(function(whileLoopRes) {
					resolve("whileLoopDone");
				}, function(e) {
					reject(e);
				});
			});
			break;
		case "prog":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var evaluateProgPromise = evaluateProg(exp, workerScript, 0);
				evaluateProgPromise.then(function(w) {
					resolve(workerScript);
				}, function(e) {
                    workerScript.errorMessage = e.toString();
					reject(workerScript);
				});
			});
			break;

		/* Currently supported function calls:
		 * 		hack(server)
		 *		sleep(N) - sleep N seconds
		 *		print(x) - Prints a variable or constant
		 *      grow(server)
         *      nuke(server)
         *      brutessh(server)
         *      ftpcrack(server)
         *      relaysmtp(server)
         *      httpworm(server)
         *      sqlinject(server)
		 */ 
		case "call":
			//Define only valid function calls here, like hack() and stuff
			//var func = evaluate(exp.func, env);
			//return func.apply(null, exp.args.map(function(arg){
			//	return evaluate(arg, env);
			//}));
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				setTimeout(function() {
					if (exp.func.value == "hack") {
						if (exp.args.length != 1) {
							reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Hack() call has incorrect number of arguments. Takes 1 argument");
						}
						var ipPromise = evaluate(exp.args[0], workerScript);

						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into hack() command");
                                workerScript.scriptRef.log("Cannot hack(). Invalid IP or hostname passed in: " + ip + ". Stopping...");
                                return;
                            }
                            
							//Calculate the hacking time 
							var hackingTime = scriptCalculateHackingTime(server); //This is in seconds
							
                            //No root access or skill level too low
							if (server.hasAdminRights == false) {
								workerScript.scriptRef.log("Cannot hack this server (" + server.hostname + ") because user does not have root access");
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Script crashed because it did not have root access to " + server.hostname);
                                return;
							}
                            
                            if (server.requiredHackingSkill > Player.hacking_skill) {
                                workerScript.scriptRef.log("Cannot hack this server (" + server.hostaname + ") because user does not have root access");
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Script crashed because player's hacking skill is not high enough to hack " + server.hostname);
                                return;
                            }
                            
                            workerScript.scriptRef.log("Attempting to hack " + ip + " in " + hackingTime.toFixed(3) + " seconds");
							
							var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								console.log("Hacking " + server.hostname + " after " + hackingTime.toString() + " seconds.");
								setTimeout(function() {
                                    if (env.stopFlag) {reject(workerScript);}
									var hackChance = scriptCalculateHackingChance(server);
									var rand = Math.random();
									var expGainedOnSuccess = scriptCalculateExpGain(server);
									var expGainedOnFailure = (expGainedOnSuccess / 4);
									if (rand < hackChance) {	//Success!
                                        if (env.stopFlag) {reject(workerScript); return;}
										var moneyGained = scriptCalculatePercentMoneyHacked(server);
										moneyGained = Math.floor(server.moneyAvailable * moneyGained);
										
										//Safety check
										if (moneyGained <= 0) {moneyGained = 0;}
										
										server.moneyAvailable -= moneyGained;
										Player.gainMoney(moneyGained);
										workerScript.scriptRef.onlineMoneyMade += moneyGained;
                                        console.log("About to add to moneystolenmap for " + server.hostname);
                                        workerScript.scriptRef.moneyStolenMap[server.ip] += moneyGained;
										
                                        Player.gainHackingExp(expGainedOnSuccess);
										workerScript.scriptRef.onlineExpGained += expGainedOnSuccess;
										console.log("Script successfully hacked " + server.hostname + " for $" + formatNumber(moneyGained, 2) + " and " + formatNumber(expGainedOnSuccess, 4) +  " exp");
                                        workerScript.scriptRef.log("Script SUCCESSFULLY hacked " + server.hostname + " for $" + formatNumber(moneyGained, 2) + " and " + formatNumber(expGainedOnSuccess, 4) +  " exp");
										resolve("Hack success");
									} else {	
                                        if (env.stopFlag) {reject(workerScript); return;}
										//Player only gains 25% exp for failure? TODO Can change this later to balance
                                        Player.gainHackingExp(expGainedOnFailure);
										workerScript.scriptRef.onlineExpGained += expGainedOnFailure;
										
										console.log("Script unsuccessful to hack " + server.hostname + ". Gained " + formatNumber(expGainedOnFailure, 4) + " exp");
                                        workerScript.scriptRef.log("Script FAILED to hack " + server.hostname + ". Gained " + formatNumber(expGainedOnFailure, 4) + " exp");
										resolve("Hack failure");
									}
								}, hackingTime * 1000);
							});
							
							p.then(function(res) {
								resolve("hackExecuted");
							}, function(e) {
								reject(e);
							});
						}, function(e) {
							reject(e);
						});

					} else if (exp.func.value == "sleep") {
						if (exp.args.length != 1) {
							reject("|" + workerScript.serverIp + "|" + workerScript.name + "|sleep() call has incorrect number of arguments. Takes 1 argument.");
						}
						var sleepTimePromise = evaluate(exp.args[0], workerScript);
						sleepTimePromise.then(function(sleepTime) {
                            workerScript.scriptRef.log("Sleeping for " + sleepTime + " milliseconds");
							var p = new Promise(function(resolve, reject) {
								setTimeout(function() {
									resolve("foo");
								}, sleepTime);
							});
						
							p.then(function(res) {
								resolve("sleepExecuted");
							}, function(e) {
								reject(e);
							});
						}, function(e) {
							reject(e)
						});
					} else if (exp.func.value == "print") {
						if (exp.args.length != 1) {
							reject("|" + workerScript.serverIp + "|" + workerScript.name + "|print() call has incorrect number of arguments. Takes 1 argument");
						}
						
						var p = new Promise(function(resolve, reject) {
							setTimeout(function() {
								var evaluatePromise = evaluate(exp.args[0], workerScript);
								evaluatePromise.then(function(res) {
									resolve(res);
								}, function(e) {
									reject(e);
								});
							}, CONSTANTS.CodeInstructionRunTime);
						});
					
						p.then(function(res) {
							workerScript.scriptRef.log(res.toString());
							resolve("printExecuted");
						}, function(e) {
							reject(e);
						});
					} else if (exp.func.value == "grow") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|grow() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into grow() command");
                                workerScript.scriptRef.log("Cannot grow(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            							
                            //No root access or skill level too low
							if (server.hasAdminRights == false) {
								workerScript.scriptRef.log("Cannot grow this server (" + server.hostname + ") because user does not have root access");
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Script crashed because it did not have root access to " + server.hostname);
                                return;
							}
                            
                            workerScript.scriptRef.log("Calling grow() on server " + server.hostname + " in 120 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
									var growthPercentage = processSingleServerGrowth(server, 450);
                                    resolve(growthPercentage);
								}, 120 * 1000); //grow() takes flat 2 minutes right now
							});
                            
                            p.then(function(growthPercentage) {
								resolve("hackExecuted");
                                workerScript.scriptRef.log("Using grow(), the money available on " + server.hostname + " was grown by " + (growthPercentage*100 - 100).toFixed(6) + "%. Gained 1 hacking exp");
                                Player.gainHackingExp(1);
                                workerScript.scriptRef.onlineExpGained += 1;
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "nuke") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|nuke() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into nuke() command");
                                workerScript.scriptRef.log("Cannot nuke(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.NukeProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have NUKE program on home computer");
                                return;
                            }
                            
                            if (server.openPortCount < server.numOpenPortsRequired) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Not enough ports opened to use NUKE.exe virus");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running NUKE.exe on server " + server.hostname + " in 5 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (server.hasAdminRights) {
                                        workerScript.scriptRef.log("Already have root access to " + server.hostname);
                                    } else {
                                        server.hasAdminRights = true;
                                        workerScript.scriptRef.log("Executed NUKE.exe virus on " + server.hostname + " to gain root access");
                                    }
									resolve("nuke done");
								}, 5 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("nukeExecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "brutessh") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|brutessh() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into brutessh() command");
                                workerScript.scriptRef.log("Cannot brutessh(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.BruteSSHProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have BruteSSH.exe program on home computer");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running BruteSSH.exe on server " + server.hostname + " in 10 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (!server.sshPortOpen) {
                                        workerScript.scriptRef.log("Executed BruteSSH.exe virus on " + server.hostname + " to open SSH port (22)");
                                        server.sshPortOpen = true; 
                                        ++server.openPortCount;
                                    } else {
                                        workerScript.scriptRef.log("SSH Port (22) already opened on " + server.hostname);
                                    }
                                    resolve("brutessh done");
								}, 10 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("bruteSSHExecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "ftpcrack") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|ftpcrack() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into ftpcrack() command");
                                workerScript.scriptRef.log("Cannot ftpcrack(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.FTPCrackProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have FTPCrack.exe program on home computer");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running FTPCrack.exe on server " + server.hostname + " in 15 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (!server.ftpPortOpen) {
                                        workerScript.scriptRef.log("Executed FTPCrack.exe virus on " + server.hostname + " to open FTP port (21)");
                                        server.ftpPortOpen = true; 
                                        ++server.openPortCount;
                                    } else {
                                        workerScript.scriptRef.log("FTP Port (21) already opened on " + server.hostname);
                                    }
                                    resolve("ftpcrack done");
								}, 15 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("ftpcrackexecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "relaysmtp") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|relaysmtp() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into relaysmtp() command");
                                workerScript.scriptRef.log("Cannot relaysmtp(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.RelaySMTPProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have relaySMTP.exe program on home computer");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running relaySMTP.exe on server " + server.hostname + " in 20 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (!server.smtpPortOpen) {
                                        workerScript.scriptRef.log("Executed relaySMTP.exe virus on " + server.hostname + " to open SMTP port (25)");
                                        server.smtpPortOpen = true; 
                                        ++server.openPortCount;
                                    } else {
                                        workerScript.scriptRef.log("SMTP Port (25) already opened on " + server.hostname);
                                    }
                                    resolve("relaysmtp done");
								}, 20 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("relaysmtpexecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "httpworm") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|httpworm() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into relaysmtp() command");
                                workerScript.scriptRef.log("Cannot httpworm(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.HTTPWormProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have HTTPWorm.exe program on home computer");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running HTTPWorm.exe on server " + server.hostname + " in 25 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (!server.httpPortOpen) {
                                        workerScript.scriptRef.log("Executed HTTPWorm.exe virus on " + server.hostname + " to open HTTP port (25)");
                                        server.httpPortOpen = true; 
                                        ++server.openPortCount;
                                    } else {
                                        workerScript.scriptRef.log("HTTP Port (80) already opened on " + server.hostname);
                                    }
                                    resolve("httpworm done");
								}, 25 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("HTTPWormexecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    } else if (exp.func.value == "sqlinject") {
                        if (exp.args.length != 1) {
                            reject("|" + workerScript.serverIp + "|" + workerScript.name + "|sqlinject() call has incorrect number of arguments. Takes 1 argument");
                        }
						var ipPromise = evaluate(exp.args[0], workerScript);
						ipPromise.then(function(ip) {
                            var server = getServer(ip);
                            if (server == null) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Invalid IP or hostname passed into sqlinject() command");
                                workerScript.scriptRef.log("Cannot sqlinject(). Invalid IP or hostname passed in: " + ip);
                                return;
                            }
                            
                            if (!Player.hasProgram(Programs.SQLInjectProgram)) {
                                reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Player does not have SQLInject.exe program on home computer");
                                return;
                            }
                            
                            workerScript.scriptRef.log("Running SQLInject.exe on server " + server.hostname + " in 30 seconds");
                            var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								setTimeout(function() {
                                    if (!server.sqlPortOpen) {
                                        workerScript.scriptRef.log("Executed SQLInject.exe virus on " + server.hostname + " to open SQL port (1433)");
                                        server.sqlPortOpen = true; 
                                        ++server.openPortCount;
                                    } else {
                                        workerScript.scriptRef.log("SQL Port (1433) already opened on " + server.hostname);
                                    }
                                    resolve("sqlinject done");
								}, 30 * 1000);
							});
                            
                            p.then(function(res) {
								resolve("sqlinjectexecuted");
							}, function(e) {
								reject(e);
							});
                        }, function(e) {
							reject(e);
						});
                    }
				}, CONSTANTS.CodeInstructionRunTime);
			});
			break;

		default:
			reject("|" + workerScript.serverIp + "|" + workerScript.name + "|Can't evaluate type " + exp.type);
    }
}

//Evaluate the looping part of a for loop (Initialization block is NOT done in here)
function evaluateFor(exp, workerScript) {
	var env = workerScript.env;
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		var pCond = new Promise(function(resolve, reject) {
			setTimeout(function() {
				var evaluatePromise = evaluate(exp.cond, workerScript);
				evaluatePromise.then(function(resCond) {
					resolve(resCond);
				}, function(e) {
					reject(e);
				});
			}, CONSTANTS.CodeInstructionRunTime);
		});
		
		pCond.then(function(resCond) {
			if (resCond) {
				//Run the for loop code
				var pCode = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var evaluatePromise = evaluate(exp.code, workerScript);
						evaluatePromise.then(function(resCode) {
							resolve(resCode);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
				
				//After the code executes make a recursive call
				pCode.then(function(resCode) {
					var pPostLoop = new Promise(function(resolve, reject) {
						setTimeout(function() {
							var evaluatePromise = evaluate(exp.postloop, workerScript);
							evaluatePromise.then(function(foo) {
								resolve("postLoopFinished");
							}, function(e) {
								reject(e);
							});
						}, CONSTANTS.CodeInstructionRunTime);
					});
					
					pPostLoop.then(function(resPostloop) {
						var recursiveCall = evaluateFor(exp, workerScript);
						recursiveCall.then(function(foo) {
							resolve("endForLoop");
						}, function(e) {
							reject(e);
						});
					}, function(e) {
						reject(e);
					});

				}, function(e) {
					reject(e);
				});
			} else {
				resolve("endForLoop");	//Doesn't need to resolve to any particular value
			}
		}, function(e) {
			reject(e);
		});
	});
}

function evaluateWhile(exp, workerScript) {
	var env = workerScript.env;
	
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		var pCond = new Promise(function(resolve, reject) {
			setTimeout(function() {
				var evaluatePromise = evaluate(exp.cond, workerScript);
				evaluatePromise.then(function(resCond) {
					resolve(resCond);
				}, function(e) {
					reject(e);	
				});
			}, CONSTANTS.CodeInstructionRunTime);
		});
		
		pCond.then(function(resCond) {
			if (resCond) {
				//Run the while loop code
				var pCode = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var evaluatePromise = evaluate(exp.code, workerScript);
						evaluatePromise.then(function(resCode) {
							resolve(resCode);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
				
				//After the code executes make a recursive call
				pCode.then(function(resCode) {
					var recursiveCall = evaluateWhile(exp, workerScript);
					recursiveCall.then(function(foo) {
						resolve("endWhileLoop");
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			} else {
				resolve("endWhileLoop");	//Doesn't need to resolve to any particular value
			}
		}, function(e) {
			reject(e);
		});
	});
}

function evaluateProg(exp, workerScript, index) {
	var env = workerScript.env;
	
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		if (index >= exp.prog.length) {
			resolve("progFinished");
		} else {
			//Evaluate this line of code in the prog
			var code = new Promise(function(resolve, reject) {
				setTimeout(function() {
					var evaluatePromise = evaluate(exp.prog[index], workerScript); 
					evaluatePromise.then(function(evalRes) {
						resolve(evalRes);
					}, function(e) {
						reject(e);
					});
				}, CONSTANTS.CodeInstructionRunTime);
			});
			
			//After the code finishes evaluating, evaluate the next line recursively
			code.then(function(codeRes) {
				var nextLine = evaluateProg(exp, workerScript, index + 1);
				nextLine.then(function(nextLineRes) {
					resolve(workerScript);
				}, function(e) {
					reject(e);
				});
			}, function(e) {
				reject(e);
			});
		}
	});
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x != "number")
            throw new Error("Expected number but got " + x);
        return x;
    }
    function div(x) {
        if (num(x) == 0)
            throw new Error("Divide by zero");
        return x;
    }
    switch (op) {
      case "+": return num(a) + num(b);
      case "-": return num(a) - num(b);
      case "*": return num(a) * num(b);
      case "/": return num(a) / div(b);
      case "%": return num(a) % div(b);
      case "&&": return a !== false && b;
      case "||": return a !== false ? a : b;
      case "<": return num(a) < num(b);
      case ">": return num(a) > num(b);
      case "<=": return num(a) <= num(b);
      case ">=": return num(a) >= num(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
} 

function isScriptErrorMessage(msg) {
    splitMsg = msg.split("|");
    if (splitMsg.length != 4){
        return false;
    }
    var ip = splitMsg[1];
    if (!isValidIPAddress(ip)) {
        return false;
    }
    return true;
}

//The same as Player's calculateHackingChance() function but takes in the server as an argument
function scriptCalculateHackingChance(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (2 * Player.hacking_chance_mult * Player.hacking_skill);
    var skillChance = (skillMult - server.requiredHackingSkill) / skillMult;
    var chance = skillChance * difficultyMult;
    if (chance < 0) {return 0;}
    else {return chance;}
}

//The same as Player's calculateHackingTime() function but takes in the server as an argument
function scriptCalculateHackingTime(server) {
	var difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
	var skillFactor = (2.5 * difficultyMult + 500) / (Player.hacking_skill + 50);
	var hackingTime = skillFactor * Player.hacking_speed_mult * 5; //This is in seconds
	return hackingTime;
}

//The same as Player's calculateExpGain() function but takes in the server as an argument 
function scriptCalculateExpGain(server) {
	return (server.hackDifficulty * Player.hacking_exp_mult);
}

//The same as Player's calculatePercentMoneyHacked() function but takes in the server as an argument
function scriptCalculatePercentMoneyHacked(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (Player.hacking_skill - (server.requiredHackingSkill - 1)) / Player.hacking_skill;
    var percentMoneyHacked = difficultyMult * skillMult * Player.hacking_money_mult / 1000;
    if (percentMoneyHacked < 0) {return 0;}
    if (percentMoneyHacked > 1) {return 1;}
    return percentMoneyHacked;
} 