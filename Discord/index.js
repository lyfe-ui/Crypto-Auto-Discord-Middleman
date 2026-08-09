// Made by Nori (lyfe-ui) - No credits needed, selling/distribution is not permitted
// https://github.com/lyfe-ui

const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ChannelType, ButtonStyle, TextInputBuilder, ModalBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { IdentifyMM, Ticket, ConfirmationOne, PaymentMM } = require('./database/index')
const mongoose = require('mongoose');
const axios = require('axios');
const noblox = require('noblox.js');
const crypto = require('crypto')
const io = require('socket.io-client');

const socket = io('apiLink', { // insert API Link
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`Connected with: ${socket.id}`);
});

socket.on('connect_error', (error) => {
  console.error('Socket.io connection error:', error);
});

socket.on('disconnect', () => {
  console.log('Socket.io disconnected');
});

const discordIds = {
	guild: '1198025479303725086', // Discord Guild ID
	mmChannel: '1198031369373220915', // Channel to send Middleman Open Message
	clientRole: '1189358453353885746', // Role given to the client
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages] });
client.login('discordToken'); // discordToken

client.once(Events.ClientReady, async c => {
	console.log(`Discord Client Ready! Logged in as ${c.user.tag}`);
	client.mmGuild = client.guilds.cache.get(discordIds.guild);

	await mongoose.connect('mongodbLink'); // mongoKey
    console.log("Connected to the database.");

	require('./purchase');
});

socket.on('payment-error', async (data) => {
	console.log('Payment Error received:', data.error);
	const targetChannel = client.channels.cache.get(data.channelId.toString())

	if (targetChannel) {
		const errorEmbed = new EmbedBuilder()
		.setTitle('An Error Occurred')
		.setDescription(`An error occured whilst processing your request, support has been notified.\n\n\`\`\`${data.error}\`\`\``)
		.setColor('#FF0000');

		await targetChannel.send({ content: "@everyone", embeds: [errorEmbed]});
	} else {
		console.error('Invalid or non-text Discord channel:', data.channelId);
	}
});

socket.on('payment-processing', async (data) => {
	const targetChannel = client.channels.cache.get(data.channelId.toString())
	console.log('Payment Processing - ' + targetChannel) 

	if (targetChannel) {
		const errorEmbed = new EmbedBuilder()
		.setTitle('Payment Processing')
		.setDescription(`A payment has been detected by our system, please wait until you get a confirmation message before sending any items to the sender of the crypto.`)
		.setColor('#00FF00');

		await targetChannel.send({ embeds: [errorEmbed]});
	} else {
		console.error('Invalid or non-text Discord channel:', data.channelId);
	}
});

socket.on('payment-confirmed', async (data) => {
	const targetChannel = client.channels.cache.get(data.channelId.toString())

	if (targetChannel) {
		const confirmedEmbed = new EmbedBuilder()
		.setTitle('Payment Confirmed')
		.setDescription(`The payment has now been confirmed by the system, you can release the funds at any time. If you decide to press cancel, a team member will need valid proof that the item(s) was not delivered.`)
		.setColor('#953CD3');

		const releaseFunds = new ButtonBuilder({
			style: ButtonStyle.Success,
			label: 'Release',
			customId: 'release',
		});
		
		const cancel = new ButtonBuilder({
			style: ButtonStyle.Danger,
			label: 'Cancel',
			customId: 'cancelend',
		});
		
		const row2 = new ActionRowBuilder()
			.addComponents([releaseFunds, cancel]);

		await targetChannel.send({ embeds: [confirmedEmbed], components: [row2] });
	} else {
		console.error('Invalid or non-text Discord channel:', data.channelId);
	}
});

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (interaction.isStringSelectMenu() && interaction.customId == "selectcrypto") {
			const selectedValue = interaction.values[0];
		
			if (selectedValue === 'btc') {		
			  const ticket = await Ticket.findOneAndUpdate(
				{ category: 'btc' },
				{ $inc: { ticketCount: 1 } },
				{ upsert: true, new: true }
			  );
		
			  const channel = await interaction.guild.channels.create({
				name: `${ticket.category}-${ticket.ticketCount}`,
				type: ChannelType.GuildText,
				parent: '1', // Channel for Middleman Tickets
				permissionOverwrites: [
				  {
					id: interaction.guild.id,
					deny: [PermissionsBitField.Flags.ViewChannel],
				  },
				  {
					id: interaction.user.id,
					allow: [PermissionsBitField.Flags.ViewChannel],
				  },
				],
			  });

			  const close = new ButtonBuilder({
				style: ButtonStyle.Danger,
				label: 'Close Ticket',
				customId: 'closeas',
			});

			const rowe = new ActionRowBuilder()
				.addComponents([close]);

			let finalizedId = generateOrderId()
		
			  channel.send({ content: `\`\`\`${finalizedId}\`\`\``, components: [rowe] })

			  channel.edit({
				topic: `${finalizedId}`,
			  });
  
			  let mmTicket = new IdentifyMM({
					  crypto: "btc",
					  identifier: `${finalizedId}`,
					  address: "nil",
					  status: "started",
					  sender: `0`,
					  receiver: `0`,
					  channelId: `${channel.id.toString()}`,
					  creatorUserId: `${interaction.user.id.toString()}`,
					  otherUserId: `0`,
					  amountInUsd: `0`,
					  amountInCrypto: `0`,
					  createdAt: Date.now(),
				  }) 
  
			  await mmTicket.save()
  
			  await interaction.reply({ content: `Escrow request has been created in ${channel}`, ephemeral: true })
  
			  const addUser = new EmbedBuilder()
				  .setTitle('Add User')
				  .setDescription(`**In order to start this deal, please add the other user to the ticket via their Discord User ID.**\n\n**Example:**\n\`\`\`14819923888477716361\`\`\``)
				  .setTimestamp()
				  .setColor("#953CD3");
  
			  const add = new ButtonBuilder({
				  style: ButtonStyle.Success,
				  label: 'Add User',
				  customId: 'adduser',
			  });
  
			  const row = new ActionRowBuilder()
				  .addComponents([add]);
  
			  return channel.send({ embeds: [addUser], components: [row] });
			} else if (selectedValue === 'ltc') {		
				const ticket = await Ticket.findOneAndUpdate(
				  { category: 'ltc' },
				  { $inc: { ticketCount: 1 } },
				  { upsert: true, new: true }
				);
		  
				const channel = await interaction.guild.channels.create({
				  name: `${ticket.category}-${ticket.ticketCount}`,
				  type: ChannelType.GuildText,
				  parent: '1198376447908262008',
				  permissionOverwrites: [
					{
					  id: interaction.guild.id,
					  deny: [PermissionsBitField.Flags.ViewChannel],
					},
					{
					  id: interaction.user.id,
					  allow: [PermissionsBitField.Flags.ViewChannel],
					},
				  ],
				});
  
				const close = new ButtonBuilder({
				  style: ButtonStyle.Danger,
				  label: 'Close Ticket',
				  customId: 'closeas',
			  });
  
			  const rowe = new ActionRowBuilder()
				  .addComponents([close]);
  
			  let finalizedId = generateOrderId()
		  
				channel.send({ content: `\`\`\`${finalizedId}\`\`\``, components: [rowe] })
  
				channel.edit({
				  topic: `${finalizedId}`,
				});
	
				let mmTicket = new IdentifyMM({
						crypto: "ltc",
						identifier: `${finalizedId}`,
						address: "nil",
						status: "started",
						sender: `0`,
						receiver: `0`,
						channelId: `${channel.id.toString()}`,
						creatorUserId: `${interaction.user.id.toString()}`,
						otherUserId: `0`,
						amountInUsd: `0`,
						amountInCrypto: `0`,
						createdAt: Date.now(),
					}) 
	
				await mmTicket.save()
	
				await interaction.reply({ content: `Escrow request has been created in ${channel}`, ephemeral: true })
	
				const addUser = new EmbedBuilder()
					.setTitle('Add User')
					.setDescription(`**In order to start this deal, please add the other user to the ticket via their Discord User ID.**\n\n**Example:**\n\`\`\`14819923888477716361\`\`\``)
					.setTimestamp()
					.setColor("#953CD3");
	
				const add = new ButtonBuilder({
					style: ButtonStyle.Success,
					label: 'Add User',
					customId: 'adduser',
				});
	
				const row = new ActionRowBuilder()
					.addComponents([add]);
	
				return channel.send({ embeds: [addUser], components: [row] });
			} else if (selectedValue === 'eth') {		
				const ticket = await Ticket.findOneAndUpdate(
				  { category: 'eth' },
				  { $inc: { ticketCount: 1 } },
				  { upsert: true, new: true }
				);
		  
				const channel = await interaction.guild.channels.create({
				  name: `${ticket.category}-${ticket.ticketCount}`,
				  type: ChannelType.GuildText,
				  parent: '1198376447908262008',
				  permissionOverwrites: [
					{
					  id: interaction.guild.id,
					  deny: [PermissionsBitField.Flags.ViewChannel],
					},
					{
					  id: interaction.user.id,
					  allow: [PermissionsBitField.Flags.ViewChannel],
					},
				  ],
				});
  
				const close = new ButtonBuilder({
				  style: ButtonStyle.Danger,
				  label: 'Close Ticket',
				  customId: 'closeas',
			  });
  
			  const rowe = new ActionRowBuilder()
				  .addComponents([close]);
  
			  let finalizedId = generateOrderId()
		  
				channel.send({ content: `\`\`\`${finalizedId}\`\`\``, components: [rowe] })
  
				channel.edit({
				  topic: `${finalizedId}`,
				});
	
				let mmTicket = new IdentifyMM({
						crypto: "eth",
						identifier: `${finalizedId}`,
						address: "nil",
						status: "started",
						sender: `0`,
						receiver: `0`,
						channelId: `${channel.id.toString()}`,
						creatorUserId: `${interaction.user.id.toString()}`,
						otherUserId: `0`,
						amountInUsd: `0`,
						amountInCrypto: `0`,
						createdAt: Date.now(),
					}) 
	
				await mmTicket.save()
	
				await interaction.reply({ content: `Escrow request has been created in ${channel}`, ephemeral: true })
	
				const addUser = new EmbedBuilder()
					.setTitle('Add User')
					.setDescription(`**In order to start this deal, please add the other user to the ticket via their Discord User ID.**\n\n**Example:**\n\`\`\`14819923888477716361\`\`\``)
					.setTimestamp()
					.setColor("#953CD3");
	
				const add = new ButtonBuilder({
					style: ButtonStyle.Success,
					label: 'Add User',
					customId: 'adduser',
				});
	
				const row = new ActionRowBuilder()
					.addComponents([add]);
	
				return channel.send({ embeds: [addUser], components: [row] });
			} else if (selectedValue === 'usdt') {		
				const ticket = await Ticket.findOneAndUpdate(
				  { category: 'usdt' },
				  { $inc: { ticketCount: 1 } },
				  { upsert: true, new: true }
				);
		  
				const channel = await interaction.guild.channels.create({
				  name: `${ticket.category}-${ticket.ticketCount}`,
				  type: ChannelType.GuildText,
				  parent: '1198376447908262008',
				  permissionOverwrites: [
					{
					  id: interaction.guild.id,
					  deny: [PermissionsBitField.Flags.ViewChannel],
					},
					{
					  id: interaction.user.id,
					  allow: [PermissionsBitField.Flags.ViewChannel],
					},
				  ],
				});
  
				const close = new ButtonBuilder({
				  style: ButtonStyle.Danger,
				  label: 'Close Ticket',
				  customId: 'closeas',
			  });
  
			  const rowe = new ActionRowBuilder()
				  .addComponents([close]);
  
			  let finalizedId = generateOrderId()
		  
				channel.send({ content: `\`\`\`${finalizedId}\`\`\``, components: [rowe] })
  
				channel.edit({
				  topic: `${finalizedId}`,
				});
	
				let mmTicket = new IdentifyMM({
						crypto: "usdt",
						identifier: `${finalizedId}`,
						address: "nil",
						status: "started",
						sender: `0`,
						receiver: `0`,
						channelId: `${channel.id.toString()}`,
						creatorUserId: `${interaction.user.id.toString()}`,
						otherUserId: `0`,
						amountInUsd: `0`,
						amountInCrypto: `0`,
						createdAt: Date.now(),
					}) 
	
				await mmTicket.save()
	
				await interaction.reply({ content: `Escrow request has been created in ${channel}`, ephemeral: true })
	
				const addUser = new EmbedBuilder()
					.setTitle('Add User')
					.setDescription(`**In order to start this deal, please add the other user to the ticket via their Discord User ID.**\n\n**Example:**\n\`\`\`14819923888477716361\`\`\``)
					.setTimestamp()
					.setColor("#953CD3");
	
				const add = new ButtonBuilder({
					style: ButtonStyle.Success,
					label: 'Add User',
					customId: 'adduser',
				});
	
				const row = new ActionRowBuilder()
					.addComponents([add]);
	
				return channel.send({ embeds: [addUser], components: [row] });
			} else if (selectedValue === 'doge') {		
				const ticket = await Ticket.findOneAndUpdate(
				  { category: 'doge' },
				  { $inc: { ticketCount: 1 } },
				  { upsert: true, new: true }
				);
		  
				const channel = await interaction.guild.channels.create({
				  name: `${ticket.category}-${ticket.ticketCount}`,
				  type: ChannelType.GuildText,
				  parent: '1198376447908262008',
				  permissionOverwrites: [
					{
					  id: interaction.guild.id,
					  deny: [PermissionsBitField.Flags.ViewChannel],
					},
					{
					  id: interaction.user.id,
					  allow: [PermissionsBitField.Flags.ViewChannel],
					},
				  ],
				});
  
				const close = new ButtonBuilder({
				  style: ButtonStyle.Danger,
				  label: 'Close Ticket',
				  customId: 'closeas',
			  });
  
			  const rowe = new ActionRowBuilder()
				  .addComponents([close]);
  
			  let finalizedId = generateOrderId()
		  
				channel.send({ content: `\`\`\`${finalizedId}\`\`\``, components: [rowe] })
  
				channel.edit({
				  topic: `${finalizedId}`,
				});
	
				let mmTicket = new IdentifyMM({
						crypto: "doge",
						identifier: `${finalizedId}`,
						address: "nil",
						status: "started",
						sender: `0`,
						receiver: `0`,
						channelId: `${channel.id.toString()}`,
						creatorUserId: `${interaction.user.id.toString()}`,
						otherUserId: `0`,
						amountInUsd: `0`,
						amountInCrypto: `0`,
						createdAt: Date.now(),
					}) 
	
				await mmTicket.save()
	
				await interaction.reply({ content: `Escrow request has been created in ${channel}`, ephemeral: true })
	
				const addUser = new EmbedBuilder()
					.setTitle('Add User')
					.setDescription(`**In order to start this deal, please add the other user to the ticket via their Discord User ID.**\n\n**Example:**\n\`\`\`14819923888477716361\`\`\``)
					.setTimestamp()
					.setColor("#953CD3");
	
				const add = new ButtonBuilder({
					style: ButtonStyle.Success,
					label: 'Add User',
					customId: 'adduser',
				});
	
				const row = new ActionRowBuilder()
					.addComponents([add]);
	
				return channel.send({ embeds: [addUser], components: [row] });
			  }
			
		} else if(interaction.isButton() && interaction.customId == 'adduser') {
			const modal = new ModalBuilder()
				.setCustomId('addusermm')
				.setTitle('Add Other User');

			const amountInput = new TextInputBuilder()
				.setCustomId('otheruser')
				.setLabel('ex. 213120401411004001')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);

			const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
			
			modal.addComponents(firstActionRow);
			await interaction.showModal(modal);
		} else if (interaction.isModalSubmit() && interaction.customId == 'addusermm') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			interaction.deferUpdate()

			const otherUser = interaction.fields.getTextInputValue('otheruser');

			if (otherUser.toString() === mmTicket.otherUserId) {
				return
			}

			const otherUserObject = client.users.cache.get(otherUser);

			if (!otherUserObject || isNaN(otherUser)) {
				const errorEmbed = new EmbedBuilder()
				.setTitle('An Error Occurred')
				.setDescription('Please provide the valid Discord UserID of the other user.')
				.setColor('#FF0000');

				await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
				return;
			}

			const poembed = new EmbedBuilder()
				.setTitle('Assign Roles')
				.setDescription(`**Please assign the correct roles to both parties, this cannot be changed later.**\n\n**Sender:**\n\`\`\`None\`\`\`\n\n**Receiver:**\n\`\`\`None\`\`\``)
				.setTimestamp()
				.setColor("#953CD3")

			const sender = new ButtonBuilder({
				style: ButtonStyle.Primary,
				label: 'Sender',
				customId: 'sender',
			});

			const receiver = new ButtonBuilder({
				style: ButtonStyle.Success,
				label: 'Receiver',
				customId: 'receiver',
			});

			const Reset = new ButtonBuilder({
				style: ButtonStyle.Danger,
				label: 'Reset',
				customId: 'reset',
			});

			const row = new ActionRowBuilder()
				.addComponents([sender, receiver, Reset]);

			await interaction.channel.edit({
				permissionOverwrites: [
				  {
					id: interaction.guild.id,
					deny: [PermissionsBitField.Flags.ViewChannel],
				  },
				  {
					id: interaction.user.id,
					allow: [PermissionsBitField.Flags.ViewChannel],
				  },
				  {
					id: otherUserObject.id,
					allow: [PermissionsBitField.Flags.ViewChannel],
				  },
				],
			  });

			interaction.channel.send({ embeds: [poembed], components: [row] });

			mmTicket.otherUserId = `${otherUser.toString()}`

			await mmTicket.save()

			try {
				interaction.message.delete()
			} catch (err) {
				console.log(err)
			}
		} else if (interaction.isButton() && interaction.customId == 'sender') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			interaction.deferUpdate()

			if (interaction.user.id.toString() === mmTicket.receiver) {
				return
			}

			if (mmTicket.sender === "0") {
				const poembed = new EmbedBuilder()
					.setTitle('Assign Roles')
					.setDescription(`**Please assign the correct roles to both parties, this cannot be changed later.**\n\n**Sender:**\n${interaction.user}\n\n**Receiver:**\n${mmTicket.receiver === "0" ? 'None' : `<@!${mmTicket.receiver}>`}`)
					.setTimestamp()
					.setColor("#953CD3");

				mmTicket.sender = interaction.user.id.toString()
				await mmTicket.save()

				interaction.message.edit({ embeds: [poembed] })

				if (mmTicket.receiver !== "0" && mmTicket.sender !== "0") {
					let confirmOne = new ConfirmationOne({
						channelId: `${interaction.channel.id.toString()}`,
						sender: "0",
						receiver: "0"
					})

					const aembed = new EmbedBuilder()
						.setTitle('Confirm')
						.setDescription(`**Please confirm that the sender and receiver is listed correctly.\n\n**Sender:**\n${mmTicket.sender === "0" ? 'None' : `<@!${mmTicket.sender}>`}\n\n**Receiver:**\n${interaction.user}`)
						.setTimestamp()
						.setColor("#953CD3");

					await confirmOne.save()

					const confirm = new ButtonBuilder({
						style: ButtonStyle.Success,
						label: 'Confirm',
						customId: 'confirmone',
					});
		
					const reject = new ButtonBuilder({
						style: ButtonStyle.Danger,
						label: 'Reject',
						customId: 'reject',
					});
		
					const row = new ActionRowBuilder()
						.addComponents([confirm, reject]);

					interaction.channel.send({ content: `<@${mmTicket.sender}> <@${mmTicket.receiver}>`, embeds: [aembed], components: [row] })
					try {
						interaction.message.delete()
					} catch (err) {
						console.log(err)
					}
				}
			}
		} else if (interaction.isButton() && interaction.customId == 'receiver') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			interaction.deferUpdate()

			if (interaction.user.id.toString() === mmTicket.sender) {
				return
			}

			if (mmTicket.receiver === "0") {
				const poembed = new EmbedBuilder()
					.setTitle('Assign Roles')
					.setDescription(`**Please assign the correct roles to both parties, this cannot be changed later.**\n\n**Sender:**\n${mmTicket.sender === "0" ? 'None' : `<@!${mmTicket.sender}>`}\n\n**Receiver:**\n${interaction.user}`)
					.setTimestamp()
					.setColor("#953CD3");

				mmTicket.receiver = interaction.user.id.toString()
				await mmTicket.save()

				interaction.message.edit({ embeds: [poembed] })

				if (mmTicket.receiver !== "0" && mmTicket.sender !== "0") {
					let confirmOne = new ConfirmationOne({
						channelId: `${interaction.channel.id.toString()}`,
						sender: "0",
						receiver: "0"
					})

					const aembed = new EmbedBuilder()
						.setTitle('Confirm')
						.setDescription(`**Please confirm that the sender and receiver is listed correctly.\n\n**Sender:**\n${mmTicket.sender === "0" ? 'None' : `<@!${mmTicket.sender}>`}\n\n**Receiver:**\n${interaction.user}`)
						.setTimestamp()
						.setColor("#953CD3");

					await confirmOne.save()

					const confirm = new ButtonBuilder({
						style: ButtonStyle.Success,
						label: 'Confirm',
						customId: 'confirmone',
					});
		
					const reject = new ButtonBuilder({
						style: ButtonStyle.Danger,
						label: 'Reject',
						customId: 'reject',
					});
		
					const row = new ActionRowBuilder()
						.addComponents([confirm, reject]);

					interaction.channel.send({ content: `<@${mmTicket.sender}> <@${mmTicket.receiver}>`, embeds: [aembed], components: [row] })
					try {
						interaction.message.delete()
					} catch (err) {
						console.log(err)
					}
				}
			}
		} else if (interaction.isButton() && interaction.customId == 'reset') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			interaction.deferUpdate()
			
			const poembed = new EmbedBuilder()
					.setTitle('Assign Roles')
					.setDescription(`**Please assign the correct roles to both parties, this cannot be changed later.**\n\n**Sender:**\nNone\n\n**Receiver:**\nNone`)
					.setTimestamp()
					.setColor("#953CD3");

			mmTicket.sender = "0"
			mmTicket.receiver = "0"
			await mmTicket.save()

			interaction.message.edit({ embeds: [poembed] })
		} else if (interaction.isButton() && interaction.customId == 'reject') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })
			await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })

			const poembed = new EmbedBuilder()
					.setTitle('Assign Roles')
					.setDescription(`**Please assign the correct roles to both parties, this cannot be changed later.**\n\n**Sender:**\nNone\n\n**Receiver:**\nNone`)
					.setTimestamp()
					.setColor("#953CD3");

			mmTicket.sender = "0"
			mmTicket.receiver = "0"
			await mmTicket.save()

			const sender = new ButtonBuilder({
				style: ButtonStyle.Primary,
				label: 'Sender',
				customId: 'sender',
			});

			const receiver = new ButtonBuilder({
				style: ButtonStyle.Success,
				label: 'Receiver',
				customId: 'receiver',
			});

			const Reset = new ButtonBuilder({
				style: ButtonStyle.Danger,
				label: 'Reset',
				customId: 'reset',
			});

			const row = new ActionRowBuilder()
				.addComponents([sender, receiver, Reset]);

			interaction.reply({ embeds: [poembed], components: [row] })

			try {
				interaction.message.delete()
			} catch (err) {
				console.log(err)
			}
		} else if (interaction.isButton() && interaction.customId == 'confirmone') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })
			let confirmationOne = await ConfirmationOne.findOne({ channelId: interaction.channel.id.toString() })

			if (interaction.user.id.toString() === mmTicket.sender) {
				if (confirmationOne.sender == "0") {
					interaction.deferUpdate()
					const poembed = new EmbedBuilder()
						.setTitle('Confirmation')
						.setDescription(`**The sender <@!${mmTicket.sender}> has confirmed that this is correct.**\n\n**Sender:**\n<@!${mmTicket.sender}>\n\n**Receiver:**\n<@!${mmTicket.receiver}>`)
						.setTimestamp()
						.setColor("#953CD3");

					confirmationOne.sender = mmTicket.sender
					await confirmationOne.save()

					interaction.message.edit({ embeds: [poembed] })

					if (confirmationOne.sender !== "0" && confirmationOne.receiver !== "0") {
						const poeambed = new EmbedBuilder()
							.setTitle('Confirmation')
							.setDescription(`**The receiver is <@!${mmTicket.receiver}> and the sender is <@!${mmTicket.sender}>**`)
							.setTimestamp()
							.setColor("#00FF00");

						interaction.message.edit({ embeds: [poeambed] })

						const anembed = new EmbedBuilder()
							.setTitle('Deal Amount')
							.setDescription(`Please state the deal amount.\n\n**Example:**\n\`\`\`98.54 or 98\`\`\``)
							.setTimestamp()
							.setColor("#953CD3");

						interaction.channel.send({ content: `<@!${mmTicket.sender}>`, embeds: [anembed] })

						try {
							interaction.message.edit({ components: []})
							mmTicket.status = "amount"
							await mmTicket.save()
							await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })
						} catch (err) {
							console.log(err)
						}
					}
				}
			} else if (interaction.user.id.toString() === mmTicket.receiver) {
				if (confirmationOne.receiver == "0") {
					const poembed = new EmbedBuilder()
						.setTitle('Confirmation')
						.setDescription(`**The receiver <@!${mmTicket.receiver}> has confirmed that this is correct.**\n\n**Sender:**\n<@!${mmTicket.sender}>\n\n**Receiver:**\n<@!${mmTicket.receiver}>`)
						.setTimestamp()
						.setColor("#953CD3");

					confirmationOne.receiver = mmTicket.receiver
					await confirmationOne.save()

					interaction.message.edit({ embeds: [poembed] })

					if (confirmationOne.sender !== "0" && confirmationOne.receiver !== "0") {
						const poeambed = new EmbedBuilder()
							.setTitle('Confirmation')
							.setDescription(`**The receiver is <@!${mmTicket.receiver}> and the sender is <@!${mmTicket.sender}>**`)
							.setTimestamp()
							.setColor("#00FF00");

						interaction.message.edit({ embeds: [poeambed] })
						const anembed = new EmbedBuilder()
							.setTitle('Deal Amount')
							.setDescription(`Please state the deal amount.\n\n**Example:**\n\`\`\`98.54 or 98\`\`\``)
							.setTimestamp()
							.setColor("#953CD3");

						interaction.channel.send({ content: `<@!${mmTicket.sender}>`, embeds: [anembed] })

						try {
							interaction.message.edit({ components: []})
							mmTicket.status = "amount"
							await mmTicket.save()
							await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })
						} catch (err) {
							console.log(err)
						}
					}
				}
			}
		}  else if (interaction.isButton() && interaction.customId == 'confirmtwo') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })
			let confirmationOne = await ConfirmationOne.findOne({ channelId: interaction.channel.id.toString() })

			if (interaction.user.id.toString() === mmTicket.sender) {
				if (confirmationOne.sender == "0") {
					const poembed = new EmbedBuilder()
						.setTitle('Sender Confirmed')
						.setDescription(`**The sender <@!${mmTicket.sender}> has confirmed that this is correct.**`)
						.setTimestamp()
						.setColor("#953CD3");

					confirmationOne.sender = mmTicket.sender
					await confirmationOne.save()

					interaction.reply({ embeds: [poembed] })
					console.log('Sender:', confirmationOne.sender);
					console.log('Receiver:', confirmationOne.receiver);
					
					if (confirmationOne.sender !== "0" && confirmationOne.receiver !== "0") {
						const url = 'https://api.oxapay.com/merchants/request/whitelabel';
						const data = JSON.stringify({
							merchant: '', // Merchant API Key
							amount: mmTicket.amountInUsd,
							currency: 'USD',
							payCurrency: mmTicket.crypto,
							lifeTime: 120,
							feePaidByPayer: 1,
							callbackUrl: 'https://api.rblxspace.com/utils/oxa-callback',
							description: 'bloxauto-order',
							orderId: `${mmTicket.identifier}`,
							email: 'suhakirlapa@gmail.com'
						});

						let axiosData
						let channel = interaction.channel

						axios.post(url, data)
							.then(async response => {
								console.log('API Response:', axiosData);
								axiosData = response.data
								console.log(response.data);
								let payment = new PaymentMM({
									crypto: `${mmTicket.crypto}`,
									address: `${axiosData.address}`,
									orderId: `${mmTicket.identifier}`,
									trackId: `${axiosData.trackId}`,
									sender: `${mmTicket.sender}`,
									channelId: `${channel.id.toString()}`,
								})

								await payment.save()

								mmTicket.status = "awaitingtransaction"
								mmTicket.address = `${axiosData.address}`
								mmTicket.amountInCrypto = `${axiosData.payAmount}`
								await mmTicket.save()

								const currentTimestamp = new Date();
    
								const futureTimestamp = new Date(currentTimestamp.getTime() + 120 * 60000);

								const futureTimestampFormatted = `<t:${Math.floor(futureTimestamp.getTime() / 1000)}:R>`;

								const btcpurchase2 = new EmbedBuilder()
								btcpurchase2.setTitle('Payment Handling')
								btcpurchase2.setDescription(`The sender (<@!${mmTicket.sender}>) must send the **EXACT** amount to the address below, our Support Team cannot assist you if you fail to give the exact amount. (details below)\n\n**${axiosData.payCurrency} Address**\n\`\`\`${axiosData.address}\`\`\`\n\n**Amount in ${axiosData.payCurrency}**\n\`\`\`≈${axiosData.payAmount} (${axiosData.amount} USD)\`\`\`\n\n### After you send the amount, our systems will automatically detect it.\n\n**Payment expires ${futureTimestampFormatted}**`)
								btcpurchase2.setTimestamp()
								btcpurchase2.setColor("#953CD3")
								btcpurchase2.setImage(`${axiosData.QRCode}`)

								const copy = new ButtonBuilder({
									style: ButtonStyle.Success,
									label: ' ',
									customId: 'copy441',
								})
									.setEmoji('📋');
					
								const row = new ActionRowBuilder()
									.addComponents([copy]);

								interaction.channel.send({ embeds: [btcpurchase2], components: [row] })
								interaction.message.delete()
							})
							.catch(error => {
								console.error(error);
							});

						try {
							interaction.message.edit({ components: []})
							await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })
						} catch (err) {
							console.log(err)
						}
					}
				}
			} else if (interaction.user.id.toString() === mmTicket.receiver) {
				if (confirmationOne.receiver == "0") {
					const poembed = new EmbedBuilder()
						.setTitle('Receiver Confirmed')
						.setDescription(`**The receiver <@!${mmTicket.receiver}> has confirmed that this is correct.**`)
						.setTimestamp()
						.setColor("#953CD3");

					confirmationOne.receiver = mmTicket.receiver
					await confirmationOne.save()

					interaction.reply({ embeds: [poembed] })
					console.log('Sender:', confirmationOne.sender);
					console.log('Receiver:', confirmationOne.receiver);
					
					if (confirmationOne.sender !== "0" && confirmationOne.receiver !== "0") {
						const url = 'https://api.oxapay.com/merchants/request/whitelabel';
						const data = JSON.stringify({
							merchant: '', // Merchant Key
							amount: mmTicket.amountInUsd,
							currency: 'USD',
							payCurrency: mmTicket.crypto,
							lifeTime: 120,
							feePaidByPayer: 1,
							callbackUrl: 'https://api.rblxspace.com/utils/oxa-callback',
							description: 'bloxauto-order',
							orderId: `${mmTicket.identifier}`,
							email: 'suhakirlapa@gmail.com'
						});

						let axiosData
						let channel = interaction.channel

						axios.post(url, data)
							.then(async response => {
								console.log('API Response:', axiosData);
								axiosData = response.data
								console.log(response.data);
								let payment = new PaymentMM({
									crypto: `${mmTicket.crypto}`,
									address: `${axiosData.address}`,
									orderId: `${mmTicket.identifier}`,
									trackId: `${axiosData.trackId}`,
									sender: `${mmTicket.sender}`,
									channelId: `${channel.id.toString()}`,
								})

								await payment.save()

								mmTicket.status = "awaitingtransaction"
								mmTicket.address = `${axiosData.address}`
								mmTicket.amountInCrypto = `${axiosData.payAmount}`
								await mmTicket.save()

								const currentTimestamp = new Date();
    
								const futureTimestamp = new Date(currentTimestamp.getTime() + 120 * 60000);

								const futureTimestampFormatted = `<t:${Math.floor(futureTimestamp.getTime() / 1000)}:R>`;

								const btcpurchase2 = new EmbedBuilder()
								btcpurchase2.setTitle('Payment Handling')
								btcpurchase2.setDescription(`The sender (<@!${mmTicket.sender}>) must send the **EXACT** amount to the address below, our Support Team cannot assist you if you fail to give the exact amount. (details below)\n\n**${axiosData.payCurrency} Address**\n\`\`\`${axiosData.address}\`\`\`\n\n**Amount in ${axiosData.payCurrency}**\n\`\`\`≈${axiosData.payAmount} (${axiosData.amount} USD)\`\`\`\n\n### After you send the amount, our systems will automatically detect it.\n\n**Payment expires ${futureTimestampFormatted}**`)
								btcpurchase2.setTimestamp()
								btcpurchase2.setColor("#953CD3")
								btcpurchase2.setImage(`${axiosData.QRCode}`)

								const copy = new ButtonBuilder({
									style: ButtonStyle.Success,
									label: ' ',
									customId: 'copy441',
								})
									.setEmoji('📋');
					
								const row = new ActionRowBuilder()
									.addComponents([copy]);

								interaction.channel.send({ embeds: [btcpurchase2], components: [row] })
								interaction.message.delete()
							})
							.catch(error => {
								console.error(error);
							});

						try {
							interaction.message.edit({ components: []})
							await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })
						} catch (err) {
							console.log(err)
						}
					}
				}
			}
		} else if (interaction.isButton() && interaction.customId == 'rejecttwo') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })
			await ConfirmationOne.deleteOne({ channelId: interaction.channel.id.toString() })

			const anembed = new EmbedBuilder()
			.setTitle('Deal Amount')
			.setDescription(`Please state the deal amount.\n\n**Example:**\n\`\`\`98.54 or 98\`\`\``)
			.setTimestamp()
			.setColor("#953CD3");

			interaction.channel.send({ content: `<@!${mmTicket.sender}>`, embeds: [anembed] })

			mmTicket.status = "amount"
			await mmTicket.save()

			try {
				interaction.message.delete()
			} catch (err) {
				console.log(err)
			}
		} else if (interaction.isButton() && interaction.customId == 'copy441') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			await interaction.deferUpdate()

			let channel = interaction.channel

			channel.send(`${mmTicket.address}`)
			channel.send(`${mmTicket.amountInCrypto}`)
		} else if (interaction.isButton() && interaction.customId == 'release') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id })

			interaction.message.edit({ components: [] })

			if (mmTicket.receiver === interaction.user.id.toString() || mmTicket.status === "staff_called") {
				return;
			}

			const confirmedEmbed = new EmbedBuilder()
			.setDescription(`Prior to releasing the funds, ensure that you have obtained all items that you are intending to purchase, the button will be enabled in a few seconds.\n\n**This process is irrevirsible.**`)
			.setColor('#953CD3');
	
			const releaseFunds = new ButtonBuilder({
				style: ButtonStyle.Danger,
				label: 'Confirm Release',
				customId: 'confirmrelease',
				disabled: true,
			});

			const cancelRelease = new ButtonBuilder({
				style: ButtonStyle.Secondary,
				label: 'Cancel',
				customId: 'cancelrelease',
			});
	
			const row2 = new ActionRowBuilder()
				.addComponents([releaseFunds, cancelRelease]);
	
			interaction.reply({ embeds: [confirmedEmbed], components: [row2] });

			waitForTempDelay().then(async () => {
				const releaseFund1s = new ButtonBuilder({
					style: ButtonStyle.Danger,
					label: 'Confirm Release',
					customId: 'confirmrelease',
				});
	
				const cancelReleas1e = new ButtonBuilder({
					style: ButtonStyle.Secondary,
					label: 'Cancel',
					customId: 'cancelrelease',
				});
		
				const row21 = new ActionRowBuilder()
					.addComponents([releaseFund1s, cancelReleas1e]);

				await interaction.editReply({ embeds: [confirmedEmbed], components: [row21] })
			});
		} else if (interaction.isButton() && interaction.customId == 'confirmrelease') {
			let mmTicket = await IdentifyMM.findOne({ channelId: interaction.channel.id.toString() })

			if (mmTicket.receiver === interaction.user.id.toString() || mmTicket.status === "staff_called") {
				return;
			}

			interaction.message.edit({ components: [] })

			const confirmedEmbed = new EmbedBuilder()
				.setDescription(`Please provide your \`${mmTicket.crypto.toUpperCase()}\` address by typing in chat.`)
				.setColor('#953CD3');

			interaction.deferUpdate();

			interaction.channel.send({ content: `<@!${mmTicket.receiver}>`, embeds: [confirmedEmbed] })

			mmTicket.status = "getuseraddy"

			await mmTicket.save()

			try { 
				interaction.message.delete();
			} catch (err) {
				console.log(err)
			}
		} else if (interaction.isButton() && interaction.customId == 'closeas') {
			try { await IdentifyMM.deleteOne({ channelId: interaction.channel.id.toString() }); } catch (err) { console.log(err) }

			try {
				await interaction.channel.delete()
			} catch (err) {
				console.log(err)
			}
		}
	} catch (err) {
		console.log("Error Identified - MM System [NORM]" + err)
	}
})

client.on(Events.MessageCreate, async message => {
  const channel = message.channel;

  const targetChannelIds = [
    '1198030606974591087',
    '1198030622254444644',
    '1198030750981836910',
	'1199953898484531210',
  ];

  try {
	if (targetChannelIds.includes(channel.id.toString())) {
		message.react('1198540485808107651')
		  .then(() => message.react('1198540543114870856'))
		  .then(() => message.react('1198540573506805800'));
	  }
  } catch (err) {
	console.log(err)
  }

  let mmTicket = await IdentifyMM.findOne({ channelId: channel.id.toString() })

  if (message.author.bot) {
	return
  }

  if (!mmTicket) {
	return
  }

  try {
	if (mmTicket.status === "amount") {
		if (message.author.id.toString() === mmTicket.sender && !isNaN(message.content)) {
			if (parseFloat(message.content) < 15) {
				const embed = new EmbedBuilder()
					.setTitle('Low Amount')
					.setDescription(`Due to issues with our payment processor, we are unable to take amounts that are less than $15 for transactions.`)
					.setColor('#ff0000');

				message.channel.send({ content: `<@!${message.author.id}>`, embeds: [embed] })
			} else {
				const embed = new EmbedBuilder()
					.setTitle('Confirm Amount')
					.setDescription(`Please confirm that the deal amount of $${message.content} is correct.`)
					.setColor('#FDDA16');

				let confirmOne = new ConfirmationOne({
					channelId: `${message.channel.id.toString()}`,
					sender: "0",
					receiver: "0"
				})

				mmTicket.status = "saveamount"
				mmTicket.amountInUsd = `${message.content.toString()}`

				await mmTicket.save()
				await confirmOne.save()

				const confirm = new ButtonBuilder({
					style: ButtonStyle.Success,
					label: 'Confirm',
					customId: 'confirmtwo',
				});

				const reject = new ButtonBuilder({
					style: ButtonStyle.Danger,
					label: 'Reject',
					customId: 'rejecttwo',
				});

				const row = new ActionRowBuilder()
					.addComponents([confirm, reject]);

				message.channel.send({ content: `<@!${mmTicket.sender}> <@!${mmTicket.receiver}>`, embeds: [embed], components: [row] })
			}
		}
		console.log(`${message.content}`);
	} else if (mmTicket.status === "getuseraddy") {
		if (message.author.id.toString() === mmTicket.receiver) {
			const embed = new EmbedBuilder()
				.setTitle('Confirm Address')
				.setDescription(`Please confirm that the follow address is correct.\n\n\`\`\`${message.content}\`\`\`\n\n**Type "confirm" to confirm the address or "reject" to reject the address.**`)
				.setColor('#FDDA16');

			mmTicket.status = "payingout"
			mmTicket.address = `${message.content}`

			await mmTicket.save()

			message.channel.send({ content: `<@!${mmTicket.receiver}>`, embeds: [embed] })
		}
	} else if (mmTicket.status === "payingout") {
		if (message.author.id.toString() === mmTicket.receiver) {
			if (message.content.toLowerCase() === "confirm") {
				const url = 'https://api.oxapay.com/merchants/rate';
				const data = JSON.stringify({
					fromCurrency: `${mmTicket.crypto}`,
					toCurrency: `USD`
				});

				let amountInUsd = mmTicket.amountInUsd;
				let amountInCrypto = mmTicket.amountInCrypto;
				
				axios.post(url, data)
				.then(async response => {
					console.log(response.data.rate);
					console.log(amountInUsd)

					if (amountInUsd <= 74) {
						amountInCrypto = (amountInUsd - 0.55) / response.data.rate;
					} else if (amountInUsd >= 75 && amountInUsd <= 499) {
						amountInCrypto = (amountInUsd - 1.85) / response.data.rate;
					} else if (amountInUsd >= 500) {
						amountInCrypto = amountInCrypto - ((0.004 * amountInCrypto) / response.data.rate);
					} else {
						amountInCrypto = (amountInUsd - 1.5) / response.data.rate;
					}
			
					console.log(amountInCrypto);

					const url2 = 'https://api.oxapay.com/api/send';
					const data2 = {
						key: '', // Payout API Key
						address: `${mmTicket.address}`,
						amount: `${amountInCrypto}`,
						currency: `${mmTicket.crypto}`,
						callbackUrl: 'https://api.rblxspace.com/utils/oxa-callback'
					};

					axios.post(url2, data2)
					.then(async response => {
						console.log(response.data);
						
						mmTicket.status = "lastnomore"

						await mmTicket.save()

						if (response.data.status.toLowerCase() === "processing" || response.data.status.toLowerCase() === "sending" || response.data.status.toLowerCase() === "complete") {
							const btcpurchase2 = new EmbedBuilder()
							btcpurchase2.setTitle('Payment')
							btcpurchase2.setDescription(`Our system has put in your payment request, please wait 15-45 minutes before contacting our Support Team for any missing payments.\n\nThis channel will be deleted in 10-30 seconds, please leave a vouch in <#1198031469235404820>`)
							btcpurchase2.setTimestamp()
							btcpurchase2.setColor("#00FF00")
							btcpurchase2.setImage(`${axiosData.QRCode}`);

							interaction.reply({ embeds: [btcpurchase2] })

							let guild = client.guilds.cache.get(discordIds.guild)
							let user = guild.members.cache.get(mmTicket.sender)
							let user2 = guild.members.cache.get(mmTicket.receiver)

							user2.roles.add(discordIds.clientRole)
							user.roles.add(discordIds.clientRole)

							waitForTempDelay().then(() => {
								return channel.delete();
							});
						} else {
							const errorEmbed = new EmbedBuilder()
							.setTitle(' An Error Occurred')
							.setDescription('An error occurred whilst paying you out, the Developer has been notified.')
							.setColor('#FF0000');
			
							await message.reply({ content: "@everyone", embeds: [errorEmbed] });
						}
					})
					.catch(async error => {
						const errorEmbed = new EmbedBuilder()
						.setTitle('An Error Occurred')
						.setDescription('An error occurred whilst paying you out, the Developer has been notified.')
						.setColor('#FF0000');

						await message.reply({ content: "@everyone", embeds: [errorEmbed] });
						console.error(error);
					});
				})
				.catch(async error => {
					const errorEmbed = new EmbedBuilder()
					.setTitle('An Error Occurred')
					.setDescription('An error occurred whilst paying you out, the Developer has been notified.')
					.setColor('#FF0000');

					await message.reply({ content: "@everyone", embeds: [errorEmbed] });
					return console.error('Error:', error);
				});
			} else if (message.content.toLowerCase() === "reject") {
				const confirmedEmbed = new EmbedBuilder()
					.setDescription(`Please provide your \`${mmTicket.crypto.toUpperCase()}\` address by typing in chat.`)
					.setColor('#953CD3');
				message.reply({ content: `<@!${mmTicket.receiver}>`, embeds: [confirmedEmbed] })

				mmTicket.status = "getuseraddy"

				await mmTicket.save()
			}
		}
	}
  } catch (err) {
	console.log(err)
  }
});

function generateOrderId() {
	const timestamp = new Date().getTime();
	const randomNum = Math.floor(Math.random() * 10000);
	const uniqueString = `${timestamp}${randomNum}`;
	const orderId = crypto.createHash('sha256').update(uniqueString).digest('hex');
  
	return orderId;
  }

function waitForDelay() {
	const minDelay = 10000;
	const maxDelay = 30000;
  
	const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
	return new Promise((resolve) => {
	  setTimeout(() => {
		resolve();
	  }, delay);
	});
  }

  function waitForTempDelay() {
	const minDelay = 5000;
	const maxDelay = 10000;
  
	const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
	return new Promise((resolve) => {
	  setTimeout(() => {
		resolve();
	  }, delay);
	});
  }

async function convertRobuxToCrypto(amountRobux, conversionRate, cryptoSymbol) {
	try {
	  const usdRate = conversionRate === 1 ? 4.5 : 5.5;
  
	  const equivalentUSD = (amountRobux / 1000) * usdRate;
  
	  const cryptoPrice = await getCurrencyPrice(cryptoSymbol);
  
	  const equivalentCrypto = equivalentUSD / cryptoPrice;
  
	  return {
		equivalentUSD: equivalentUSD.toFixed(2),
		equivalentCrypto: equivalentCrypto.toFixed(6),
	  };
	} catch (error) {
	  console.error('Error converting Robux to Crypto:', error.message);
	  throw error;
	}
  }
  
async function getCurrencyPrice(currency) {
	try {
		const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${currency}&vs_currencies=usd`);
		return response.data[currency.toLowerCase()].usd;
	} catch (error) {
		console.error('Error fetching cryptocurrency price:', error.message);
		throw error;
	}
}

async function getTX(currency, tx) {
	try {
		if (tx === 'test') {
			return {
				status: true,
				outputs: {
					value: 0.06
				}
			}
		}

		const response = await axios.get(`https://api.blockcypher.com/v1/${currency}/main/txs/${tx}`);

		if (response.data.error && response.data.error === `Transaction ${tx} not found.`) {
			return { status: false, error: `Transaction ${tx} not found.` };
		}

		const outputs = response.data.outputs || [];
	
		let filteredOutputs = outputs
		if (currency === 'btc') {
			filteredOutputs.filter(output => output.addresses && output.addresses.length > 0)
			filteredOutputs.filter(output => output.addresses.some(address => address.endsWith("c1qlmwxcgdmn04vqtkdv02r4fwag66nwvhzvp5n5w")));
		} else if (currency === 'ltc') {
			filteredOutputs.filter(output => output.addresses && output.addresses.length > 0)
			filteredOutputs.filter(output => output.addresses.some(address => address.endsWith("Ly6s9y8QHuiY6Uf6R1QjrECSkoC71Rdbw")));
		} else if (currency === 'eth') {
			filteredOutputs.filter(output => output.addresses && output.addresses.length > 0)
			filteredOutputs.filter(output => output.addresses.some(address => address.endsWith("61dfc7157cca7b49a5cfb7e68041f108e1512c0")));
		}

		const receivedDate = new Date(response.data.received);
		const december262021 = new Date('2021-12-26T00:00:00Z');
		
		if (receivedDate <= december262021) {
		  return { status: false, error: `Transaction \`\`${tx}\`\` is old and is ineligible for the current processing, please use a valid TXID.` };
		}
	
		let filteredAddresses
		const formattedOutputs = filteredOutputs.map(output => {
		  
			if (currency === 'btc') {
				filteredAddresses = output.addresses.filter(address => address.endsWith("c1qlmwxcgdmn04vqtkdv02r4fwag66nwvhzvp5n5w"));
			} else if (currency === 'ltc') {
				filteredAddresses = output.addresses.filter(address => address.endsWith("Ly6s9y8QHuiY6Uf6R1QjrECSkoC71Rdbw"));
			} else if (currency === 'eth') {
				filteredAddresses = output.addresses.filter(address => address.endsWith("61dfc7157cca7b49a5cfb7e68041f108e1512c0"));
			}
	
		  const value = output.value || 0;
	
		  const formattedValue = parseFloat(value / 1e8).toFixed(8);
	
		  return {
			addresses: filteredAddresses,
			value: formattedValue,
		  };
		});
	
		return {
		  status: true,
		  outputs: formattedOutputs,
		};
	} catch (error) {
		console.error('Error fetching cryptocurrency price:', error.message);
		return { status: false, error: `Transaction \`\`${tx}\`\` not found or not to correct recipient address.` };
	}
}

module.exports = {
	discordClient: client,
	discordIds
}
